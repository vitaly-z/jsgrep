const macroEvaluators = require('./macros')
const { walkQueryExpressions, transformQueryExpressions } = require('./walkQueryExpressions')
const NotFound = {}
const EmptyQuery = {
  op: 'O_EVAL',
  expr: []
}

const expansions = {}

const expandProperties = properties => (expr, get) => {
  return [
    expr[0],
    properties.reduce(function(data, propName) {
      const expandedValue = get(data[propName])

      if (expandedValue !== NotFound) {
        data[propName] = extractValuePointFromExpansion(data[propName], expandedValue)
      }

      return data
    }, Object.assign({}, expr[1]))
  ]
}

expansions['function-call'] = expandProperties([ 'id' ])
expansions['imported-identifier'] = (expr, get) => get(expr)

const extractValuePointFromExpansion = (expr, value) => {
  return macroEvaluators.filter(x => x.on === expr[0])[0].extractPoint(value)
}

const combineVisitors = (source, partial) => {
  return Object.keys(partial).reduce(function(map, nodeType) {
    if (!map[nodeType]) {
      map[nodeType] = []
    }

    map[nodeType].push(partial[nodeType])

    return map
  }, source)
}

const apply = args => f => f.apply(null, args)
const composeVisitors = source => state => {
  return Object.keys(source).reduce(function(map, nodeType) {
    const nodeVisitors = source[nodeType]

    map[nodeType] = function() {
      const args = Array.prototype.slice.call(arguments)

      nodeVisitors.map(apply(args)).forEach(result => state.push(result))
    }
    return map
  }, {})
}

const buildMacroVisitors = query => {
  const visitors = {}
  let tally = 0

  walkQueryExpressions(query, expr => {
    macroEvaluators.filter(x => x.on === expr[0]).forEach(macro => {
      tally += 1
      combineVisitors(visitors, macro.expand(expr))
    })
  })

  return { macroCount: tally, visitors };
}

const injectExpansions = (expansionTerms, query) => {
  const get = otherExpr => {
    if (expansionTerms.has(otherExpr)) {
      return expansionTerms.get(otherExpr)
    }
    else {
      return NotFound
    }
  }

  return transformQueryExpressions(query, (expr, replace) => {
    const expand = expansions[expr[0]];

    if (!expand) {
      return;
    }

    const expansion = expand(expr, get)

    if (expansion === NotFound) {
      return;
    }

    replace(expansion)
  })
}

module.exports = function expandQueryMacros(walk, program, query) {
  const { visitors, macroCount } = buildMacroVisitors(query)

  if (macroCount === 0) {
    return query
  }

  const applyVisitors = composeVisitors(visitors)
  const results = []

  walk(program, applyVisitors(results))

  // this won't work anymore if we introduce union type matching (e.g. any
  // condition where macro expansion becomes optional)
  if (macroCount !== results.filter(x => x !== null).length) {
    return EmptyQuery
  }

  const expansionTerms = results.filter(x => !!x).reduce(function(map, [ expr, expanded ]) {
    map.set(expr, expanded)

    return map
  }, new WeakMap())

  return injectExpansions(expansionTerms, query)
}