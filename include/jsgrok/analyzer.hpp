#ifndef H_JSGROK_ANALYZER_H
#define H_JSGROK_ANALYZER_H

#include "jsgrok/types.hpp"
#include "v8/v8.h"
#include <vector>

namespace jsgrok {
  using v8::Context;
  using v8::Local;
  using v8::Value;
  using std::vector;

  class v8_session;
  class v8_module;
  class analyzer {
  public:
    typedef struct {
      string_t file;
      string_t message;
    } analysis_error_t;

    typedef struct {
      string_t file;
      string_t match;
      uint32_t line;
      uint32_t start;
      uint32_t end;
    } analysis_match_t;

    typedef struct {
      vector<analysis_error_t> errors;
      vector<analysis_match_t> matches;
    } analysis_t;

    analyzer();
    virtual ~analyzer();

    analysis_t apply(v8_session*, string_t const&, string_t const&);

  protected:
    typedef vector<Local<Value>> js_analysis_t;

    typedef struct {
      v8_session      *session;
      Local<Context>  *context;
    } require_context_t;

    js_analysis_t aggregate_results(Local<Context>&, js_analysis_t const&) const;
    analysis_t    cast_down(v8_session*, Local<Context>&, string_t const&, js_analysis_t const&) const;

    void define_require(v8_session*, Local<Context>&, require_context_t*);
    static void require(const v8::FunctionCallbackInfo<Value> &);
  };

} // end of namespace jsgrok

#endif
