/*  Prototype JavaScript framework, version 1.7
 *  (c) 2005-2010 Sam Stephenson
 *
 *  Prototype is freely distributable under the terms of an MIT-style license.
 *  For details, see the Prototype web site: http://www.prototypejs.org/
 *
 *--------------------------------------------------------------------------*/

var Prototype = {

  Version: '1.7',

  Browser: (function(){
    var ua = navigator.userAgent;
    var isOpera = Object.prototype.toString.call(window.opera) == '[object Opera]';
    var isIE = !!window.attachEvent && !isOpera;
    return {
      IE:             isIE,
      Opera:          isOpera,
      WebKit:         ua.indexOf('AppleWebKit/') > -1,
      Gecko:          ua.indexOf('Gecko') > -1 && ua.indexOf('KHTML') === -1,
      MobileSafari:   /Apple.*Mobile/.test(ua),
      Edge:           !isIE && !!window.StyleMedia
    }
  })(),

  BrowserFeatures: {
    XPath: !!document.evaluate,

    SelectorsAPI: !!document.querySelector,

    ElementExtensions: (function() {
      var constructor = window.Element || window.HTMLElement;
      return !!(constructor && constructor.prototype);
    })(),
    SpecificElementExtensions: (function() {
      if (typeof window.HTMLDivElement !== 'undefined')
        return true;

      var div = document.createElement('div'),
          form = document.createElement('form'),
          isSupported = false;

      if (div['__proto__'] && (div['__proto__'] !== form['__proto__'])) {
        isSupported = true;
      }

      div = form = null;

      return isSupported;
    })()
  },

  ScriptFragment: '<script[^>]*>([\\S\\s]*?)<\/script>',
  JSONFilter: /^\/\*-secure-([\s\S]*)\*\/\s*$/,

  emptyFunction: function() { },

  K: function(x) { return x }
};

if (Prototype.Browser.MobileSafari)
  Prototype.BrowserFeatures.SpecificElementExtensions = false;


var Abstract = { };


var Try = {
  these: function() {
    var returnValue;

    for (var i = 0, length = arguments.length; i < length; i++) {
      var lambda = arguments[i];
      try {
        returnValue = lambda();
        break;
      } catch (e) { }
    }

    return returnValue;
  }
};

/* Based on Alex Arnell's inheritance implementation. */

var Class = (function() {

  var IS_DONTENUM_BUGGY = (function(){
    for (var p in { toString: 1 }) {
      if (p === 'toString') return false;
    }
    return true;
  })();

  function subclass() {};
  function create() {
    var parent = null, properties = $A(arguments);
    if (Object.isFunction(properties[0]))
      parent = properties.shift();

    function klass() {
      this.initialize.apply(this, arguments);
    }

    Object.extend(klass, Class.Methods);
    klass.superclass = parent;
    klass.subclasses = [];

    if (parent) {
      subclass.prototype = parent.prototype;
      klass.prototype = new subclass;
      parent.subclasses.push(klass);
    }

    for (var i = 0, length = properties.length; i < length; i++)
      klass.addMethods(properties[i]);

    if (!klass.prototype.initialize)
      klass.prototype.initialize = Prototype.emptyFunction;

    klass.prototype.constructor = klass;
    return klass;
  }

  function addMethods(source) {
    var ancestor   = this.superclass && this.superclass.prototype,
        properties = Object.keys(source);

    if (IS_DONTENUM_BUGGY) {
      if (source.toString != Object.prototype.toString)
        properties.push("toString");
      if (source.valueOf != Object.prototype.valueOf)
        properties.push("valueOf");
    }

    for (var i = 0, length = properties.length; i < length; i++) {
      var property = properties[i], value = source[property];
      if (ancestor && Object.isFunction(value) &&
          value.argumentNames()[0] == "$super") {
        var method = value;
        value = (function(m) {
          return function() { return ancestor[m].apply(this, arguments); };
        })(property).wrap(method);

        value.valueOf = method.valueOf.bind(method);
        value.toString = method.toString.bind(method);
      }
      this.prototype[property] = value;
    }

    return this;
  }

  return {
    create: create,
    Methods: {
      addMethods: addMethods
    }
  };
})();
(function() {

  var _toString = Object.prototype.toString,
      NULL_TYPE = 'Null',
      UNDEFINED_TYPE = 'Undefined',
      BOOLEAN_TYPE = 'Boolean',
      NUMBER_TYPE = 'Number',
      STRING_TYPE = 'String',
      OBJECT_TYPE = 'Object',
      FUNCTION_CLASS = '[object Function]',
      BOOLEAN_CLASS = '[object Boolean]',
      NUMBER_CLASS = '[object Number]',
      STRING_CLASS = '[object String]',
      ARRAY_CLASS = '[object Array]',
      DATE_CLASS = '[object Date]',
      NATIVE_JSON_STRINGIFY_SUPPORT = window.JSON &&
        typeof JSON.stringify === 'function' &&
        JSON.stringify(0) === '0' &&
        typeof JSON.stringify(Prototype.K) === 'undefined';

  function Type(o) {
    switch(o) {
      case null: return NULL_TYPE;
      case (void 0): return UNDEFINED_TYPE;
    }
    var type = typeof o;
    switch(type) {
      case 'boolean': return BOOLEAN_TYPE;
      case 'number':  return NUMBER_TYPE;
      case 'string':  return STRING_TYPE;
    }
    return OBJECT_TYPE;
  }

  function extend(destination, source) {
    for (var property in source)
      destination[property] = source[property];
    return destination;
  }

  function inspect(object) {
    try {
      if (isUndefined(object)) return 'undefined';
      if (object === null) return 'null';
      return object.inspect ? object.inspect() : String(object);
    } catch (e) {
      if (e instanceof RangeError) return '...';
      throw e;
    }
  }

  function toJSON(value) {
    return Str('', { '': value }, []);
  }

  function Str(key, holder, stack) {
    var value = holder[key],
        type = typeof value;

    if (Type(value) === OBJECT_TYPE && typeof value.toJSON === 'function') {
      value = value.toJSON(key);
    }

    var _class = _toString.call(value);

    switch (_class) {
      case NUMBER_CLASS:
      case BOOLEAN_CLASS:
      case STRING_CLASS:
        value = value.valueOf();
    }

    switch (value) {
      case null: return 'null';
      case true: return 'true';
      case false: return 'false';
    }

    type = typeof value;
    switch (type) {
      case 'string':
        return value.inspect(true);
      case 'number':
        return isFinite(value) ? String(value) : 'null';
      case 'object':

        for (var i = 0, length = stack.length; i < length; i++) {
          if (stack[i] === value) { throw new TypeError(); }
        }
        stack.push(value);

        var partial = [];
        if (_class === ARRAY_CLASS) {
          for (var i = 0, length = value.length; i < length; i++) {
            var str = Str(i, value, stack);
            partial.push(typeof str === 'undefined' ? 'null' : str);
          }
          partial = '[' + partial.join(',') + ']';
        } else {
          var keys = Object.keys(value);
          for (var i = 0, length = keys.length; i < length; i++) {
            var key = keys[i], str = Str(key, value, stack);
            if (typeof str !== "undefined") {
               partial.push(key.inspect(true)+ ':' + str);
             }
          }
          partial = '{' + partial.join(',') + '}';
        }
        stack.pop();
        return partial;
    }
  }

  function stringify(object) {
    return JSON.stringify(object);
  }

  function toQueryString(object) {
    return $H(object).toQueryString();
  }

  function toHTML(object) {
    return object && object.toHTML ? object.toHTML() : String.interpret(object);
  }

  function keys(object) {
    if (Type(object) !== OBJECT_TYPE) { throw new TypeError(); }
    var results = [];
    for (var property in object) {
      if (object.hasOwnProperty(property)) {
        results.push(property);
      }
    }
    return results;
  }

  function values(object) {
    var results = [];
    for (var property in object)
      results.push(object[property]);
    return results;
  }

  function clone(object) {
    return extend({ }, object);
  }

  function isElement(object) {
    return !!(object && object.nodeType == 1);
  }

  function isArray(object) {
    return _toString.call(object) === ARRAY_CLASS;
  }

  var hasNativeIsArray = (typeof Array.isArray == 'function')
    && Array.isArray([]) && !Array.isArray({});

  if (hasNativeIsArray) {
    isArray = Array.isArray;
  }

  function isHash(object) {
    return object instanceof Hash;
  }

  function isFunction(object) {
    return _toString.call(object) === FUNCTION_CLASS;
  }

  function isString(object) {
    return _toString.call(object) === STRING_CLASS;
  }

  function isNumber(object) {
    return _toString.call(object) === NUMBER_CLASS;
  }

  function isDate(object) {
    return _toString.call(object) === DATE_CLASS;
  }

  function isUndefined(object) {
    return typeof object === "undefined";
  }

  extend(Object, {
    extend:        extend,
    inspect:       inspect,
    toJSON:        NATIVE_JSON_STRINGIFY_SUPPORT ? stringify : toJSON,
    toJSONEx:      toJSON,  // Leaving this in here to assist in debugging odd stringify issues in IE if we see them again in other contexts.
    toQueryString: toQueryString,
    toHTML:        toHTML,
    keys:          Object.keys || keys,
    values:        values,
    clone:         clone,
    isElement:     isElement,
    isArray:       isArray,
    isHash:        isHash,
    isFunction:    isFunction,
    isString:      isString,
    isNumber:      isNumber,
    isDate:        isDate,
    isUndefined:   isUndefined
  });
})();
Object.extend(Function.prototype, (function() {
  var slice = Array.prototype.slice;

  function update(array, args) {
    var arrayLength = array.length, length = args.length;
    while (length--) array[arrayLength + length] = args[length];
    return array;
  }

  function merge(array, args) {
    array = slice.call(array, 0);
    return update(array, args);
  }

  function argumentNames() {
    var names = this.toString().match(/^[\s\(]*function[^(]*\(([^)]*)\)/)[1]
      .replace(/\/\/.*?[\r\n]|\/\*(?:.|[\r\n])*?\*\//g, '')
      .replace(/\s+/g, '').split(',');
    return names.length == 1 && !names[0] ? [] : names;
  }

  function bind(context) {
    if (arguments.length < 2 && Object.isUndefined(arguments[0])) return this;
    var __method = this, args = slice.call(arguments, 1);
    return function() {
      var a = merge(args, arguments);
      return __method.apply(context, a);
    }
  }

  function bindAsEventListener(context) {
    var __method = this, args = slice.call(arguments, 1);
    return function(event) {
      var a = update([event || window.event], args);
      return __method.apply(context, a);
    }
  }

  function curry() {
    if (!arguments.length) return this;
    var __method = this, args = slice.call(arguments, 0);
    return function() {
      var a = merge(args, arguments);
      return __method.apply(this, a);
    }
  }

  function delay(timeout) {
    var __method = this, args = slice.call(arguments, 1);
    timeout = timeout * 1000;
    return window.setTimeout(function() {
      return __method.apply(__method, args);
    }, timeout);
  }

  function defer() {
    var args = update([0.01], arguments);
    return this.delay.apply(this, args);
  }

  function wrap(wrapper) {
    var __method = this;
    return function() {
      var a = update([__method.bind(this)], arguments);
      return wrapper.apply(this, a);
    }
  }

  function methodize() {
    if (this._methodized) return this._methodized;
    var __method = this;
    return this._methodized = function() {
      var a = update([this], arguments);
      return __method.apply(null, a);
    };
  }

  return {
    argumentNames:       argumentNames,
    bind:                bind,
    bindAsEventListener: bindAsEventListener,
    curry:               curry,
    delay:               delay,
    defer:               defer,
    wrap:                wrap,
    methodize:           methodize
  }
})());



(function(proto) {


  function toISOString() {
    return this.getUTCFullYear() + '-' +
      (this.getUTCMonth() + 1).toPaddedString(2) + '-' +
      this.getUTCDate().toPaddedString(2) + 'T' +
      this.getUTCHours().toPaddedString(2) + ':' +
      this.getUTCMinutes().toPaddedString(2) + ':' +
      this.getUTCSeconds().toPaddedString(2) + 'Z';
  }


  function toJSON() {
    return this.toISOString();
  }

  if (!proto.toISOString) proto.toISOString = toISOString;
  if (!proto.toJSON) proto.toJSON = toJSON;

})(Date.prototype);


RegExp.prototype.match = RegExp.prototype.test;

RegExp.escape = function(str) {
  return String(str).replace(/([.*+?^=!:${}()|[\]\/\\])/g, '\\$1');
};
var PeriodicalExecuter = Class.create({
  initialize: function(callback, frequency) {
    this.callback = callback;
    this.frequency = frequency;
    this.currentlyExecuting = false;

    this.registerCallback();
  },

  registerCallback: function() {
    this.timer = setInterval(this.onTimerEvent.bind(this), this.frequency * 1000);
  },

  execute: function() {
    this.callback(this);
  },

  stop: function() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  },

  onTimerEvent: function() {
    if (!this.currentlyExecuting) {
      try {
        this.currentlyExecuting = true;
        this.execute();
        this.currentlyExecuting = false;
      } catch(e) {
        this.currentlyExecuting = false;
        throw e;
      }
    }
  }
});
Object.extend(String, {
  interpret: function(value) {
    return value == null ? '' : String(value);
  },
  specialChar: {
    '\b': '\\b',
    '\t': '\\t',
    '\n': '\\n',
    '\f': '\\f',
    '\r': '\\r',
    '\\': '\\\\'
  }
});

Object.extend(String.prototype, (function() {
  var NATIVE_JSON_PARSE_SUPPORT = window.JSON &&
    typeof JSON.parse === 'function' &&
    JSON.parse('{"test": true}').test;

  function prepareReplacement(replacement) {
    if (Object.isFunction(replacement)) return replacement;
    var template = new Template(replacement);
    return function(match) { return template.evaluate(match) };
  }

  function gsub(pattern, replacement) {
    var result = '', source = this, match;
    replacement = prepareReplacement(replacement);

    if (Object.isString(pattern))
      pattern = RegExp.escape(pattern);

    if (!(pattern.length || pattern.source)) {
      replacement = replacement('');
      return replacement + source.split('').join(replacement) + replacement;
    }

    while (source.length > 0) {
      if (match = source.match(pattern)) {
        result += source.slice(0, match.index);
        result += String.interpret(replacement(match));
        source  = source.slice(match.index + match[0].length);
      } else {
        result += source, source = '';
      }
    }
    return result;
  }

  function sub(pattern, replacement, count) {
    replacement = prepareReplacement(replacement);
    count = Object.isUndefined(count) ? 1 : count;

    return this.gsub(pattern, function(match) {
      if (--count < 0) return match[0];
      return replacement(match);
    });
  }

  function scan(pattern, iterator) {
    this.gsub(pattern, iterator);
    return String(this);
  }

  function truncate(length, truncation) {
    length = length || 30;
    truncation = Object.isUndefined(truncation) ? '...' : truncation;
    return this.length > length ?
      this.slice(0, length - truncation.length) + truncation : String(this);
  }

  function strip() {
    return this.replace(/^\s+/, '').replace(/\s+$/, '');
  }

  function stripTags() {
    return this.replace(/<\w+(\s+("[^"]*"|'[^']*'|[^>])+)?>|<\/\w+>/gi, '');
  }

  function stripScripts() {
    return this.replace(new RegExp(Prototype.ScriptFragment, 'img'), '');
  }

  function extractScripts() {
    // NOTE: The original code here extracted scripts with a regex - that worked well-enough except it included scripts inside
    // comments.  An attempt was made to remove comments via a regex but (a) that caused chrome to churn 100% cpu and effectively crash sometimes
    // and (b) extract html comments via a regex is not actually possible to do 100% safely.
    // Instead, let the browser do the work for us- create an element out of this html but DO NOT ADD IT to the dom so it is never actually rendered.
    // Then just find all the scripts in that element.  If any were inside comments then they will already be properly excluded.
    var temp = document.createElement('div');
    temp.innerHTML = this;
    var scripts = temp.getElementsByTagName('script');
    if (scripts.length > 0)
    {
      var rawScripts = [];
      for (var i=0;i<scripts.length;i++)
      {
        rawScripts[i] = scripts[i].innerHTML;
      }
      return rawScripts;
    }
    return [];
  }

  function evalScripts() {
    return this.extractScripts().map(function(script) { return eval(script) });
  }

  function escapeHTML() {
    return this.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function unescapeHTML() {
    return this.stripTags().replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  }


  function toQueryParams(separator) {
    var match = this.strip().match(/([^?#]*)(#.*)?$/);
    if (!match) return { };

    return match[1].split(separator || '&').inject({ }, function(hash, pair) {
      if ((pair = pair.split('='))[0]) {
        var key = decodeURIComponent(pair.shift()),
            value = pair.length > 1 ? pair.join('=') : pair[0];

        if (value != undefined) value = decodeURIComponent(value);

        if (key in hash) {
          if (!Object.isArray(hash[key])) hash[key] = [hash[key]];
          hash[key].push(value);
        }
        else hash[key] = value;
      }
      return hash;
    });
  }

  function toArray() {
    return this.split('');
  }

  function succ() {
    return this.slice(0, this.length - 1) +
      String.fromCharCode(this.charCodeAt(this.length - 1) + 1);
  }

  function times(count) {
    return count < 1 ? '' : new Array(count + 1).join(this);
  }

  function camelize() {
    return this.replace(/-+(.)?/g, function(match, chr) {
      return chr ? chr.toUpperCase() : '';
    });
  }

  function capitalize() {
    return this.charAt(0).toUpperCase() + this.substring(1).toLowerCase();
  }

  function underscore() {
    return this.replace(/::/g, '/')
               .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
               .replace(/([a-z\d])([A-Z])/g, '$1_$2')
               .replace(/-/g, '_')
               .toLowerCase();
  }

  function dasherize() {
    return this.replace(/_/g, '-');
  }

  function inspect(useDoubleQuotes) {
    var escapedString = this.replace(/[\x00-\x1f\\]/g, function(character) {
      if (character in String.specialChar) {
        return String.specialChar[character];
      }
      return '\\u00' + character.charCodeAt().toPaddedString(2, 16);
    });
    if (useDoubleQuotes) return '"' + escapedString.replace(/"/g, '\\"') + '"';
    return "'" + escapedString.replace(/'/g, '\\\'') + "'";
  }

  function unfilterJSON(filter) {
    return this.replace(filter || Prototype.JSONFilter, '$1');
  }

  function isJSON() {
    var str = this;
    if (str.blank()) return false;
    str = str.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@');
    str = str.replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']');
    str = str.replace(/(?:^|:|,)(?:\s*\[)+/g, '');
    return (/^[\],:{}\s]*$/).test(str);
  }

  function evalJSON(sanitize) {
    var json = this.unfilterJSON(),
        cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
    if (cx.test(json)) {
      json = json.replace(cx, function (a) {
        return '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
      });
    }
    try {
      if (!sanitize || json.isJSON()) return eval('(' + json + ')');
    } catch (e) { }
    throw new SyntaxError('Badly formed JSON string: ' + this.inspect());
  }

  function parseJSON() {
    var json = this.unfilterJSON();
    return JSON.parse(json);
  }

  function include(pattern) {
    return this.indexOf(pattern) > -1;
  }

  function startsWith(pattern) {
    return this.lastIndexOf(pattern, 0) === 0;
  }

  function endsWith(pattern) {
    var d = this.length - pattern.length;
    return d >= 0 && this.indexOf(pattern, d) === d;
  }

  function empty() {
    return this == '';
  }

  function blank() {
    return /^\s*$/.test(this);
  }

  function interpolate(object, pattern) {
    return new Template(this, pattern).evaluate(object);
  }

  return {
    gsub:           gsub,
    sub:            sub,
    scan:           scan,
    truncate:       truncate,
    strip:          String.prototype.trim || strip,
    stripTags:      stripTags,
    stripScripts:   stripScripts,
    extractScripts: extractScripts,
    evalScripts:    evalScripts,
    escapeHTML:     escapeHTML,
    unescapeHTML:   unescapeHTML,
    toQueryParams:  toQueryParams,
    parseQuery:     toQueryParams,
    toArray:        toArray,
    succ:           succ,
    times:          times,
    camelize:       camelize,
    capitalize:     capitalize,
    underscore:     underscore,
    dasherize:      dasherize,
    inspect:        inspect,
    unfilterJSON:   unfilterJSON,
    isJSON:         isJSON,
    evalJSON:       NATIVE_JSON_PARSE_SUPPORT ? parseJSON : evalJSON,
    include:        include,
    startsWith:     startsWith,
    endsWith:       endsWith,
    empty:          empty,
    blank:          blank,
    interpolate:    interpolate
  };
})());

var Template = Class.create({
  initialize: function(template, pattern) {
    this.template = template.toString();
    this.pattern = pattern || Template.Pattern;
  },

  evaluate: function(object) {
    if (object && Object.isFunction(object.toTemplateReplacements))
      object = object.toTemplateReplacements();

    return this.template.gsub(this.pattern, function(match) {
      if (object == null) return (match[1] + '');

      var before = match[1] || '';
      if (before == '\\') return match[2];

      var ctx = object, expr = match[3],
          pattern = /^([^.[]+|\[((?:.*?[^\\])?)\])(\.|\[|$)/;

      match = pattern.exec(expr);
      if (match == null) return before;

      while (match != null) {
        var comp = match[1].startsWith('[') ? match[2].replace(/\\\\]/g, ']') : match[1];
        ctx = ctx[comp];
        if (null == ctx || '' == match[3]) break;
        expr = expr.substring('[' == match[3] ? match[1].length : match[0].length);
        match = pattern.exec(expr);
      }

      return before + String.interpret(ctx);
    });
  }
});
Template.Pattern = /(^|.|\r|\n)(#\{(.*?)\})/;

var $break = { };

var Enumerable = (function() {
  function each(iterator, context) {
    var index = 0;
    try {
      this._each(function(value) {
        iterator.call(context, value, index++);
      });
    } catch (e) {
      if (e != $break) throw e;
    }
    return this;
  }

  function eachSlice(number, iterator, context) {
    var index = -number, slices = [], array = this.toArray();
    if (number < 1) return array;
    while ((index += number) < array.length)
      slices.push(array.slice(index, index+number));
    return slices.collect(iterator, context);
  }

  function all(iterator, context) {
    iterator = iterator || Prototype.K;
    var result = true;
    this.each(function(value, index) {
      result = result && !!iterator.call(context, value, index);
      if (!result) throw $break;
    });
    return result;
  }

  function any(iterator, context) {
    iterator = iterator || Prototype.K;
    var result = false;
    this.each(function(value, index) {
      if (result = !!iterator.call(context, value, index))
        throw $break;
    });
    return result;
  }

  function collect(iterator, context) {
    iterator = iterator || Prototype.K;
    var results = [];
    this.each(function(value, index) {
      results.push(iterator.call(context, value, index));
    });
    return results;
  }

  function detect(iterator, context) {
    var result;
    this.each(function(value, index) {
      if (iterator.call(context, value, index)) {
        result = value;
        throw $break;
      }
    });
    return result;
  }

  function findAll(iterator, context) {
    var results = [];
    this.each(function(value, index) {
      if (iterator.call(context, value, index))
        results.push(value);
    });
    return results;
  }

  function grep(filter, iterator, context) {
    iterator = iterator || Prototype.K;
    var results = [];

    if (Object.isString(filter))
      filter = new RegExp(RegExp.escape(filter));

    this.each(function(value, index) {
      if (filter.match(value))
        results.push(iterator.call(context, value, index));
    });
    return results;
  }

  function include(object) {
    if (Object.isFunction(this.indexOf))
      if (this.indexOf(object) != -1) return true;

    var found = false;
    this.each(function(value) {
      if (value == object) {
        found = true;
        throw $break;
      }
    });
    return found;
  }

  function inGroupsOf(number, fillWith) {
    fillWith = Object.isUndefined(fillWith) ? null : fillWith;
    return this.eachSlice(number, function(slice) {
      while(slice.length < number) slice.push(fillWith);
      return slice;
    });
  }

  function inject(memo, iterator, context) {
    this.each(function(value, index) {
      memo = iterator.call(context, memo, value, index);
    });
    return memo;
  }

  function invoke(method) {
    var args = $A(arguments).slice(1);
    return this.map(function(value) {
      return value[method].apply(value, args);
    });
  }

  function max(iterator, context) {
    iterator = iterator || Prototype.K;
    var result;
    this.each(function(value, index) {
      value = iterator.call(context, value, index);
      if (result == null || value >= result)
        result = value;
    });
    return result;
  }

  function min(iterator, context) {
    iterator = iterator || Prototype.K;
    var result;
    this.each(function(value, index) {
      value = iterator.call(context, value, index);
      if (result == null || value < result)
        result = value;
    });
    return result;
  }

  function partition(iterator, context) {
    iterator = iterator || Prototype.K;
    var trues = [], falses = [];
    this.each(function(value, index) {
      (iterator.call(context, value, index) ?
        trues : falses).push(value);
    });
    return [trues, falses];
  }

  function pluck(property) {
    var results = [];
    this.each(function(value) {
      results.push(value[property]);
    });
    return results;
  }

  function reject(iterator, context) {
    var results = [];
    this.each(function(value, index) {
      if (!iterator.call(context, value, index))
        results.push(value);
    });
    return results;
  }

  function sortBy(iterator, context) {
    return this.map(function(value, index) {
      return {
        value: value,
        criteria: iterator.call(context, value, index)
      };
    }).sort(function(left, right) {
      var a = left.criteria, b = right.criteria;
      return a < b ? -1 : a > b ? 1 : 0;
    }).pluck('value');
  }

  function toArray() {
    return this.map();
  }

  function zip() {
    var iterator = Prototype.K, args = $A(arguments);
    if (Object.isFunction(args.last()))
      iterator = args.pop();

    var collections = [this].concat(args).map($A);
    return this.map(function(value, index) {
      return iterator(collections.pluck(index));
    });
  }

  function size() {
    return this.toArray().length;
  }

  function inspect() {
    return '#<Enumerable:' + this.toArray().inspect() + '>';
  }









  return {
    each:       each,
    eachSlice:  eachSlice,
    all:        all,
    every:      all,
    any:        any,
    some:       any,
    collect:    collect,
    map:        collect,
    detect:     detect,
    findAll:    findAll,
    select:     findAll,
    filter:     findAll,
    grep:       grep,
    include:    include,
    member:     include,
    inGroupsOf: inGroupsOf,
    inject:     inject,
    invoke:     invoke,
    max:        max,
    min:        min,
    partition:  partition,
    pluck:      pluck,
    reject:     reject,
    sortBy:     sortBy,
    toArray:    toArray,
    entries:    toArray,
    zip:        zip,
    size:       size,
    inspect:    inspect,
    find:       detect
  };
})();

function $A(iterable) {
  if (!iterable) return [];
  if ('toArray' in Object(iterable)) return iterable.toArray();
  var length = iterable.length || 0, results = new Array(length);
  while (length--) results[length] = iterable[length];
  return results;
}


function $w(string) {
  if (!Object.isString(string)) return [];
  string = string.strip();
  return string ? string.split(/\s+/) : [];
}

Array.from = $A;


(function() {
  var arrayProto = Array.prototype,
      slice = arrayProto.slice,
      _each = arrayProto.forEach; // use native browser JS 1.6 implementation if available

  function each(iterator, context) {
    for (var i = 0, length = this.length >>> 0; i < length; i++) {
      if (i in this) iterator.call(context, this[i], i, this);
    }
  }
  if (!_each) _each = each;

  function clear() {
    this.length = 0;
    return this;
  }

  function first() {
    return this[0];
  }

  function last() {
    return this[this.length - 1];
  }

  function compact() {
    return this.select(function(value) {
      return value != null;
    });
  }

  function flatten() {
    return this.inject([], function(array, value) {
      if (Object.isArray(value))
        return array.concat(value.flatten());
      array.push(value);
      return array;
    });
  }

  function without() {
    var values = slice.call(arguments, 0);
    return this.select(function(value) {
      return !values.include(value);
    });
  }

  function reverse(inline) {
    return (inline === false ? this.toArray() : this)._reverse();
  }

  function uniq(sorted) {
    return this.inject([], function(array, value, index) {
      if (0 == index || (sorted ? array.last() != value : !array.include(value)))
        array.push(value);
      return array;
    });
  }

  function intersect(array) {
    return this.uniq().findAll(function(item) {
      return array.detect(function(value) { return item === value });
    });
  }


  function clone() {
    return slice.call(this, 0);
  }

  function size() {
    return this.length;
  }

  function inspect() {
    return '[' + this.map(Object.inspect).join(', ') + ']';
  }

  function indexOf(item, i) {
    i || (i = 0);
    var length = this.length;
    if (i < 0) i = length + i;
    for (; i < length; i++)
      if (this[i] === item) return i;
    return -1;
  }

  function lastIndexOf(item, i) {
    i = isNaN(i) ? this.length : (i < 0 ? this.length + i : i) + 1;
    var n = this.slice(0, i).reverse().indexOf(item);
    return (n < 0) ? n : i - n - 1;
  }

  function concat() {
    var array = slice.call(this, 0), item;
    for (var i = 0, length = arguments.length; i < length; i++) {
      item = arguments[i];
      if (Object.isArray(item) && !('callee' in item)) {
        for (var j = 0, arrayLength = item.length; j < arrayLength; j++)
          array.push(item[j]);
      } else {
        array.push(item);
      }
    }
    return array;
  }

  Object.extend(arrayProto, Enumerable);

  if (!arrayProto._reverse)
    arrayProto._reverse = arrayProto.reverse;

  Object.extend(arrayProto, {
    _each:     _each,
    clear:     clear,
    first:     first,
    last:      last,
    compact:   compact,
    flatten:   flatten,
    without:   without,
    reverse:   reverse,
    uniq:      uniq,
    intersect: intersect,
    clone:     clone,
    toArray:   clone,
    size:      size,
    inspect:   inspect
  });

  var CONCAT_ARGUMENTS_BUGGY = (function() {
    return [].concat(arguments)[0][0] !== 1;
  })(1,2)

  if (CONCAT_ARGUMENTS_BUGGY) arrayProto.concat = concat;

  if (!arrayProto.indexOf) arrayProto.indexOf = indexOf;
  if (!arrayProto.lastIndexOf) arrayProto.lastIndexOf = lastIndexOf;
})();
function $H(object) {
  return new Hash(object);
};

var Hash = Class.create(Enumerable, (function() {
  function initialize(object) {
    this._object = Object.isHash(object) ? object.toObject() : Object.clone(object);
  }


  function _each(iterator) {
    for (var key in this._object) {
      var value = this._object[key], pair = [key, value];
      pair.key = key;
      pair.value = value;
      iterator(pair);
    }
  }

  function set(key, value) {
    return this._object[key] = value;
  }

  function get(key) {
    if (this._object[key] !== Object.prototype[key])
      return this._object[key];
  }

  function unset(key) {
    var value = this._object[key];
    delete this._object[key];
    return value;
  }

  function toObject() {
    return Object.clone(this._object);
  }



  function keys() {
    return this.pluck('key');
  }

  function values() {
    return this.pluck('value');
  }

  function index(value) {
    var match = this.detect(function(pair) {
      return pair.value === value;
    });
    return match && match.key;
  }

  function merge(object) {
    return this.clone().update(object);
  }

  function update(object) {
    return new Hash(object).inject(this, function(result, pair) {
      result.set(pair.key, pair.value);
      return result;
    });
  }

  function toQueryPair(key, value) {
    if (Object.isUndefined(value)) return key;
    return key + '=' + encodeURIComponent(String.interpret(value));
  }

  function toQueryString() {
    return this.inject([], function(results, pair) {
      var key = encodeURIComponent(pair.key), values = pair.value;

      if (values && typeof values == 'object') {
        if (Object.isArray(values)) {
          var queryValues = [];
          for (var i = 0, len = values.length, value; i < len; i++) {
            value = values[i];
            queryValues.push(toQueryPair(key, value));
          }
          return results.concat(queryValues);
        }
      } else results.push(toQueryPair(key, values));
      return results;
    }).join('&');
  }

  function inspect() {
    return '#<Hash:{' + this.map(function(pair) {
      return pair.map(Object.inspect).join(': ');
    }).join(', ') + '}>';
  }

  function clone() {
    return new Hash(this);
  }

  return {
    initialize:             initialize,
    _each:                  _each,
    set:                    set,
    get:                    get,
    unset:                  unset,
    toObject:               toObject,
    toTemplateReplacements: toObject,
    keys:                   keys,
    values:                 values,
    index:                  index,
    merge:                  merge,
    update:                 update,
    toQueryString:          toQueryString,
    inspect:                inspect,
    toJSON:                 toObject,
    clone:                  clone
  };
})());

Hash.from = $H;
Object.extend(Number.prototype, (function() {
  function toColorPart() {
    return this.toPaddedString(2, 16);
  }

  function succ() {
    return this + 1;
  }

  function times(iterator, context) {
    $R(0, this, true).each(iterator, context);
    return this;
  }

  function toPaddedString(length, radix) {
    var string = this.toString(radix || 10);
    return '0'.times(length - string.length) + string;
  }

  function abs() {
    return Math.abs(this);
  }

  function round() {
    return Math.round(this);
  }

  function ceil() {
    return Math.ceil(this);
  }

  function floor() {
    return Math.floor(this);
  }

  return {
    toColorPart:    toColorPart,
    succ:           succ,
    times:          times,
    toPaddedString: toPaddedString,
    abs:            abs,
    round:          round,
    ceil:           ceil,
    floor:          floor
  };
})());

function $R(start, end, exclusive) {
  return new ObjectRange(start, end, exclusive);
}

var ObjectRange = Class.create(Enumerable, (function() {
  function initialize(start, end, exclusive) {
    this.start = start;
    this.end = end;
    this.exclusive = exclusive;
  }

  function _each(iterator) {
    var value = this.start;
    while (this.include(value)) {
      iterator(value);
      value = value.succ();
    }
  }

  function include(value) {
    if (value < this.start)
      return false;
    if (this.exclusive)
      return value < this.end;
    return value <= this.end;
  }

  return {
    initialize: initialize,
    _each:      _each,
    include:    include
  };
})());



var Ajax = {
  getTransport: function() {
    return Try.these(
      function() {return new XMLHttpRequest()},
      function() {return new ActiveXObject('Msxml2.XMLHTTP')},
      function() {return new ActiveXObject('Microsoft.XMLHTTP')}
    ) || false;
  },

  activeRequestCount: 0
};

Ajax.Responders = {
  responders: [],

  _each: function(iterator) {
    this.responders._each(iterator);
  },

  register: function(responder) {
    if (!this.include(responder))
      this.responders.push(responder);
  },

  unregister: function(responder) {
    this.responders = this.responders.without(responder);
  },

  dispatch: function(callback, request, transport, json) {
    this.each(function(responder) {
      if (Object.isFunction(responder[callback])) {
        try {
          responder[callback].apply(responder, [request, transport, json]);
        } catch (e) { }
      }
    });
  },

  hasResponder: function( callback ) {
    this.each(function(responder) {
      if (Object.isFunction(responder[callback])) {
        return true;
      }
    });
    return false;
  }
};

Object.extend(Ajax.Responders, Enumerable);

Ajax.Responders.register({
  onCreate:   function() { Ajax.activeRequestCount++ },
  onComplete: function() { Ajax.activeRequestCount-- }
});
Ajax.Base = Class.create({
  initialize: function(options) {
    this.options = {
      method:       'post',
      asynchronous: true,
      contentType:  'application/x-www-form-urlencoded',
      encoding:     'UTF-8',
      parameters:   '',
      evalJSON:     true,
      evalJS:       true
    };
    Object.extend(this.options, options || { });

    this.options.method = this.options.method.toLowerCase();

    if (Object.isHash(this.options.parameters))
        this.options.parameters = this.options.parameters.toObject();
  }
});
Ajax.Request = Class.create(Ajax.Base, {
  _complete: false,

  initialize: function($super, url, options) {
    $super(options);
    this.transport = Ajax.getTransport();
    this.request(url);
  },

  request: function(url) {
    this.url = url;
    this.method = this.options.method;
    var params = Object.isString(this.options.parameters) ?
          this.options.parameters :
          Object.toQueryString(this.options.parameters);

    if (!['get', 'post'].include(this.method)) {
      params += (params ? '&' : '') + "_method=" + this.method;
      this.method = 'post';
    }

    if (params && this.method === 'get') {
      this.url += (this.url.include('?') ? '&' : '?') + params;
    }

    this.parameters = params.toQueryParams();

    try {
      var response = new Ajax.Response(this);
      if (this.options.onCreate) this.options.onCreate(response);
      Ajax.Responders.dispatch('onCreate', this, response);

      this.transport.open(this.method.toUpperCase(), this.url,
        this.options.asynchronous);

      if (this.options.asynchronous) this.respondToReadyState.bind(this).defer(1);

      this.transport.onreadystatechange = this.onStateChange.bind(this);
      this.setRequestHeaders();

      this.body = this.method == 'post' ? (this.options.postBody || params) : null;
      this.transport.send(this.body);

      /* Force Firefox to handle ready state 4 for synchronous requests */
      if (!this.options.asynchronous && this.transport.overrideMimeType)
        this.onStateChange();

    }
    catch (e) {
      this.dispatchException(e);
    }
  },

  onStateChange: function() {
    var readyState = this.transport.readyState;
    if (readyState > 1 && !((readyState == 4) && this._complete))
      this.respondToReadyState(this.transport.readyState);
  },

  setRequestHeaders: function() {
    var headers = {
      'X-Requested-With': 'XMLHttpRequest',
      'X-Prototype-Version': Prototype.Version,
      'Accept': 'text/javascript, text/html, application/xml, text/xml, */*'
    };

    if (this.method == 'post') {
      headers['Content-type'] = this.options.contentType +
        (this.options.encoding ? '; charset=' + this.options.encoding : '');

      /* Force "Connection: close" for older Mozilla browsers to work
       * around a bug where XMLHttpRequest sends an incorrect
       * Content-length header. See Mozilla Bugzilla #246651.
       */
      if (this.transport.overrideMimeType &&
          (navigator.userAgent.match(/Gecko\/(\d{4})/) || [0,2005])[1] < 2005)
            headers['Connection'] = 'close';
    }

    if (typeof this.options.requestHeaders == 'object') {
      var extras = this.options.requestHeaders;

      if (Object.isFunction(extras.push))
        for (var i = 0, length = extras.length; i < length; i += 2)
          headers[extras[i]] = extras[i+1];
      else
        $H(extras).each(function(pair) { headers[pair.key] = pair.value });
    }

    for (var name in headers)
      this.transport.setRequestHeader(name, headers[name]);
  },

  success: function() {
    var status = this.getStatus();
    return !status || (status >= 200 && status < 300) || status == 304;
  },

  getStatus: function() {
    try {
      if (this.transport.status === 1223) return 204;
      return this.transport.status || 0;
    } catch (e) { return 0 }
  },

  respondToReadyState: function(readyState) {
    var state = Ajax.Request.Events[readyState];
    // quite a high number of Interactive events can be generated on some browsers
    // triggering a memory issue in FF3 when building the response object. So if there is no
    // registered listener, quick return
    // see https://bugzilla.mozilla.org/show_bug.cgi?id=453709
    if ( state == 'Interactive' )
    {
      if ( this.notListeningToInteractive )
      {
        if ( this.notListeningToInteractive.value ) return;
      }
      else
      {
        this.notListeningToInteractive = new Object();
        this.notListeningToInteractive.value = ( !this.options['onInteractive'] && !Ajax.Responders.hasResponder( state ) );
        if ( this.notListeningToInteractive.value ) return;
      }
    }
    var response = new Ajax.Response(this);

    if (state == 'Complete') {
      try {
        this._complete = true;
        (this.options['on' + response.status]
         || this.options['on' + (this.success() ? 'Success' : 'Failure')]
         || Prototype.emptyFunction)(response, response.headerJSON);
      } catch (e) {
        this.dispatchException(e);
      }

      var contentType = response.getHeader('Content-type');
      if (this.options.evalJS == 'force'
          || (this.options.evalJS && this.isSameOrigin() && contentType
          && contentType.match(/^\s*(text|application)\/(x-)?(java|ecma)script(;.*)?\s*$/i)))
        this.evalResponse();
    }

    try {
      (this.options['on' + state] || Prototype.emptyFunction)(response, response.headerJSON);
      Ajax.Responders.dispatch('on' + state, this, response, response.headerJSON);
    } catch (e) {
      this.dispatchException(e);
    }

    if (state == 'Complete') {
      this.transport.onreadystatechange = Prototype.emptyFunction;
    }
  },

  isSameOrigin: function() {
    var m = this.url.match(/^\s*https?:\/\/[^\/]*/);
    return !m || (m[0] == '#{protocol}//#{domain}#{port}'.interpolate({
      protocol: location.protocol,
      domain: document.domain,
      port: location.port ? ':' + location.port : ''
    }));
  },

  getHeader: function(name) {
    try {
      return this.transport.getResponseHeader(name) || null;
    } catch (e) { return null; }
  },

  evalResponse: function() {
    try {
      return eval((this.transport.responseText || '').unfilterJSON());
    } catch (e) {
      this.dispatchException(e);
    }
  },

  dispatchException: function(exception) {
    (this.options.onException || Prototype.emptyFunction)(this, exception);
    Ajax.Responders.dispatch('onException', this, exception);
  }
});

Ajax.Request.Events =
  ['Uninitialized', 'Loading', 'Loaded', 'Interactive', 'Complete'];








Ajax.Response = Class.create({
  initialize: function(request){
    this.request = request;
    var transport  = this.transport  = request.transport,
        readyState = this.readyState = transport.readyState;

    if ((readyState > 2 && !Prototype.Browser.IE) || readyState == 4) {
      this.status       = this.getStatus();
      this.statusText   = this.getStatusText();
      this.responseText = String.interpret(transport.responseText);
      this.headerJSON   = this._getHeaderJSON();
    }

    if (readyState == 4) {
      var xml = transport.responseXML;
      this.responseXML  = Object.isUndefined(xml) ? null : xml;
      this.responseJSON = this._getResponseJSON();
    }
  },

  status:      0,

  statusText: '',

  getStatus: Ajax.Request.prototype.getStatus,

  getStatusText: function() {
    try {
      return this.transport.statusText || '';
    } catch (e) { return '' }
  },

  getHeader: Ajax.Request.prototype.getHeader,

  getAllHeaders: function() {
    try {
      return this.getAllResponseHeaders();
    } catch (e) { return null }
  },

  getResponseHeader: function(name) {
    return this.transport.getResponseHeader(name);
  },

  getAllResponseHeaders: function() {
    return this.transport.getAllResponseHeaders();
  },

  _getHeaderJSON: function() {
    var json = this.getHeader('X-JSON');
    if (!json) return null;
    json = decodeURIComponent(escape(json));
    try {
      return json.evalJSON(this.request.options.sanitizeJSON ||
        !this.request.isSameOrigin());
    } catch (e) {
      this.request.dispatchException(e);
    }
  },

  _getResponseJSON: function() {
    var options = this.request.options;
    if (!options.evalJSON || (options.evalJSON != 'force' &&
      !(this.getHeader('Content-type') || '').include('application/json')) ||
        this.responseText.blank())
          return null;
    try {
      return this.responseText.evalJSON(options.sanitizeJSON ||
        !this.request.isSameOrigin());
    } catch (e) {
      this.request.dispatchException(e);
    }
  }
});

Ajax.Updater = Class.create(Ajax.Request, {
  initialize: function($super, container, url, options) {
    this.container = {
      success: (container.success || container),
      failure: (container.failure || (container.success ? null : container))
    };

    options = Object.clone(options);
    var onComplete = options.onComplete;
    options.onComplete = (function(response, json) {
      this.updateContent(response.responseText);
      if (Object.isFunction(onComplete)) onComplete(response, json);
    }).bind(this);

    $super(url, options);
  },

  updateContent: function(responseText) {
    var receiver = this.container[this.success() ? 'success' : 'failure'],
        options = this.options;

    if (!options.evalScripts) responseText = responseText.stripScripts();

    if (receiver = $(receiver)) {
      if (options.insertion) {
        if (Object.isString(options.insertion)) {
          var insertion = { }; insertion[options.insertion] = responseText;
          receiver.insert(insertion);
        }
        else options.insertion(receiver, responseText);
      }
      else receiver.update(responseText);
    }
  }
});

Ajax.PeriodicalUpdater = Class.create(Ajax.Base, {
  initialize: function($super, container, url, options) {
    $super(options);
    this.onComplete = this.options.onComplete;

    this.frequency = (this.options.frequency || 2);
    this.decay = (this.options.decay || 1);

    this.updater = { };
    this.container = container;
    this.url = url;

    this.start();
  },

  start: function() {
    this.options.onComplete = this.updateComplete.bind(this);
    this.onTimerEvent();
  },

  stop: function() {
    this.updater.options.onComplete = undefined;
    clearTimeout(this.timer);
    (this.onComplete || Prototype.emptyFunction).apply(this, arguments);
  },

  updateComplete: function(response) {
    if (this.options.decay) {
      this.decay = (response.responseText == this.lastText ?
        this.decay * this.options.decay : 1);

      this.lastText = response.responseText;
    }
    this.timer = this.onTimerEvent.bind(this).delay(this.decay * this.frequency);
  },

  onTimerEvent: function() {
    this.updater = new Ajax.Updater(this.container, this.url, this.options);
  }
});

function $s(element) {
  if (Object.isString(element)) {
    return document.getElementById(element);
  }
  return element;
}

function $(element) {
  if (arguments.length > 1) {
    for (var i = 0, elements = [], length = arguments.length; i < length; i++)
      elements.push($(arguments[i]));
    return elements;
  }
  if (Object.isString(element))
    element = document.getElementById(element);
  return Element.extend(element);
}

if (Prototype.BrowserFeatures.XPath) {
  document._getElementsByXPath = function(expression, parentElement) {
    var results = [];
    var query = document.evaluate(expression, $(parentElement) || document,
      null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    for (var i = 0, length = query.snapshotLength; i < length; i++)
      results.push(Element.extend(query.snapshotItem(i)));
    return results;
  };
}

/*--------------------------------------------------------------------------*/

if (!Node) var Node = { };

if (!Node.ELEMENT_NODE) {
  Object.extend(Node, {
    ELEMENT_NODE: 1,
    ATTRIBUTE_NODE: 2,
    TEXT_NODE: 3,
    CDATA_SECTION_NODE: 4,
    ENTITY_REFERENCE_NODE: 5,
    ENTITY_NODE: 6,
    PROCESSING_INSTRUCTION_NODE: 7,
    COMMENT_NODE: 8,
    DOCUMENT_NODE: 9,
    DOCUMENT_TYPE_NODE: 10,
    DOCUMENT_FRAGMENT_NODE: 11,
    NOTATION_NODE: 12
  });
}



(function(global) {
  function shouldUseCache(tagName, attributes) {
    if (tagName === 'select') return false;
    if ('type' in attributes) return false;
    return true;
  }

  var HAS_EXTENDED_CREATE_ELEMENT_SYNTAX = (function(){
    try {
      var el = document.createElement('<input name="x">');
      return el.tagName.toLowerCase() === 'input' && el.name === 'x';
    }
    catch(err) {
      return false;
    }
  })();

  var element = global.Element;

  global.Element = function(tagName, attributes) {
    attributes = attributes || { };
    tagName = tagName.toLowerCase();
    var cache = Element.cache;

    if (HAS_EXTENDED_CREATE_ELEMENT_SYNTAX && attributes.name) {
      tagName = '<' + tagName + ' name="' + attributes.name + '">';
      delete attributes.name;
      return Element.writeAttribute(document.createElement(tagName), attributes);
    }

    if (!cache[tagName]) cache[tagName] = Element.extend(document.createElement(tagName));

    var node = shouldUseCache(tagName, attributes) ?
     cache[tagName].cloneNode(false) : document.createElement(tagName);

    return Element.writeAttribute(node, attributes);
  };

  Object.extend(global.Element, element || { });
  if (element) global.Element.prototype = element.prototype;

})(this);

Element.idCounter = 1;
Element.cache = { };

Element._purgeElement = function(element) {
  var uid = element._prototypeUID;
  if (uid) {
    Element.stopObserving(element);
    element._prototypeUID = void 0;
    delete Element.Storage[uid];
  }
}

Element.Methods = {
  visible: function(element) {
    return $(element).style.display != 'none';
  },

  toggle: function(element) {
    element = $(element);
    Element[Element.visible(element) ? 'hide' : 'show'](element);
    return element;
  },

  hide: function(element) {
    element = $(element);
    element.style.display = 'none';
    return element;
  },

  show: function(element) {
    element = $(element);
    element.style.display = '';
    return element;
  },

  // only extend the element if it is a string - otherwise we don't need to extend the element
  remove: function(element) {
    if (Object.isString(element)) {
      element = $(element);
    }
    if (element.parentNode) {
        element.parentNode.removeChild(element);
    }
    return element;
  },

  update: (function(){

    var SELECT_ELEMENT_INNERHTML_BUGGY = (function(){
      var el = document.createElement("select"),
          isBuggy = true;
      el.innerHTML = "<option value=\"test\">test</option>";
      if (el.options && el.options[0]) {
        isBuggy = el.options[0].nodeName.toUpperCase() !== "OPTION";
      }
      el = null;
      return isBuggy;
    })();

    var TABLE_ELEMENT_INNERHTML_BUGGY = (function(){
      try {
        var el = document.createElement("table");
        if (el && el.tBodies) {
          el.innerHTML = "<tbody><tr><td>test</td></tr></tbody>";
          var isBuggy = typeof el.tBodies[0] == "undefined";
          el = null;
          return isBuggy;
        }
      } catch (e) {
        return true;
      }
    })();

    var LINK_ELEMENT_INNERHTML_BUGGY = (function() {
      try {
        var el = document.createElement('div');
        el.innerHTML = "<link>";
        var isBuggy = (el.childNodes.length === 0);
        el = null;
        return isBuggy;
      } catch(e) {
        return true;
      }
    })();

    var ANY_INNERHTML_BUGGY = SELECT_ELEMENT_INNERHTML_BUGGY ||
     TABLE_ELEMENT_INNERHTML_BUGGY || LINK_ELEMENT_INNERHTML_BUGGY;

    var SCRIPT_ELEMENT_REJECTS_TEXTNODE_APPENDING = (function () {
      var s = document.createElement("script"),
          isBuggy = false;
      try {
        s.appendChild(document.createTextNode(""));
        isBuggy = !s.firstChild ||
          s.firstChild && s.firstChild.nodeType !== 3;
      } catch (e) {
        isBuggy = true;
      }
      s = null;
      return isBuggy;
    })();


    function update(element, content) {
      element = $(element);
      var purgeElement = Element._purgeElement;

      var descendants = element.getElementsByTagName('*'),
       i = descendants.length;
      while (i--) purgeElement(descendants[i]);

      if (content && content.toElement)
        content = content.toElement();

      if (Object.isElement(content))
        return element.update().insert(content);

      content = Object.toHTML(content);

      var tagName = element.tagName.toUpperCase();

      if (tagName === 'SCRIPT' && SCRIPT_ELEMENT_REJECTS_TEXTNODE_APPENDING) {
        element.text = content;
        return element;
      }

      if (ANY_INNERHTML_BUGGY) {
        if (tagName in Element._insertionTranslations.tags) {
          while (element.firstChild) {
            element.removeChild(element.firstChild);
          }
          Element._getContentFromAnonymousElement(tagName, content.stripScripts())
            .each(function(node) {
              element.appendChild(node)
            });
        } else if (LINK_ELEMENT_INNERHTML_BUGGY && Object.isString(content) && content.indexOf('<link') > -1) {
          while (element.firstChild) {
            element.removeChild(element.firstChild);
          }
          var nodes = Element._getContentFromAnonymousElement(tagName, content.stripScripts(), true);
          nodes.each(function(node) { element.appendChild(node) });
        }
        else {
          element.innerHTML = content.stripScripts();
        }
      }
      else {
        element.innerHTML = content.stripScripts();
      }

      content.evalScripts.bind(content).defer();
      return element;
    }

    return update;
  })(),

  replace: function(element, content) {
    element = $(element);
    if (content && content.toElement) content = content.toElement();
    else if (!Object.isElement(content)) {
      content = Object.toHTML(content);
      var range = element.ownerDocument.createRange();
      range.selectNode(element);
      content.evalScripts.bind(content).defer();
      content = range.createContextualFragment(content.stripScripts());
    }
    element.parentNode.replaceChild(content, element);
    return element;
  },

  insert: function(element, insertions) {
    element = $(element);

    if (Object.isString(insertions) || Object.isNumber(insertions) ||
        Object.isElement(insertions) || (insertions && (insertions.toElement || insertions.toHTML)))
          insertions = {bottom:insertions};

    var content, insert, tagName, childNodes;

    for (var position in insertions) {
      content  = insertions[position];
      position = position.toLowerCase();
      insert = Element._insertionTranslations[position];

      if (content && content.toElement) content = content.toElement();
      if (Object.isElement(content)) {
        insert(element, content);
        continue;
      }

      content = Object.toHTML(content);

      tagName = ((position == 'before' || position == 'after')
        ? element.parentNode : element).tagName.toUpperCase();

      childNodes = Element._getContentFromAnonymousElement(tagName, content.stripScripts());

      if (position == 'top' || position == 'after') childNodes.reverse();
      childNodes.each(insert.curry(element));

      content.evalScripts.bind(content).defer();
    }

    return element;
  },

  wrap: function(element, wrapper, attributes) {
    element = $(element);
    if (Object.isElement(wrapper))
      $(wrapper).writeAttribute(attributes || { });
    else if (Object.isString(wrapper)) wrapper = new Element(wrapper, attributes);
    else wrapper = new Element('div', wrapper);
    if (element.parentNode)
      element.parentNode.replaceChild(wrapper, element);
    wrapper.appendChild(element);
    return wrapper;
  },

  inspect: function(element) {
    element = $(element);
    var result = '<' + element.tagName.toLowerCase();
    $H({'id': 'id', 'className': 'class'}).each(function(pair) {
      var property = pair.first(),
          attribute = pair.last(),
          value = (element[property] || '').toString();
      if (value) result += ' ' + attribute + '=' + value.inspect(true);
    });
    return result + '>';
  },

  recursivelyCollect: function(element, property, maximumLength) {
    element = $(element);
    maximumLength = maximumLength || -1;
    var elements = [];

    while (element = element[property]) {
      if (element.nodeType == 1)
        elements.push(Element.extend(element));
      if (elements.length == maximumLength)
        break;
    }

    return elements;
  },

  // Collect items without extending them all:
  rawRecursivelyCollect: function(element, property) {
    element = $(element);
    var elements = [];
    while (element = element[property])
      if (element.nodeType == 1) {
          elements.push(element);
      }
    return elements;
  },

  ancestors: function(element) {
    return Element.recursivelyCollect(element, 'parentNode');
  },

  descendants: function(element) {
    return Element.select(element, "*");
  },

  firstDescendant: function(element) {
    element = $(element).firstChild;
    while (element && element.nodeType != 1) element = element.nextSibling;
    return $(element);
  },

  immediateDescendants: function(element) {
    var results = [], child = $(element).firstChild;
    while (child) {
      if (child.nodeType === 1) {
        results.push(Element.extend(child));
      }
      child = child.nextSibling;
    }
    return results;
  },

  // Find the immediate descendents of the given element without extending them all
  rawImmediateDescendants: function(element) {
    if (!(element = $(element).firstChild)) return [];
    while (element && element.nodeType != 1) element = element.nextSibling;
    if (element) return [element].concat($(element).rawNextSiblings());
    return [];
  },

  previousSiblings: function(element, maximumLength) {
    return Element.recursivelyCollect(element, 'previousSibling');
  },

  nextSiblings: function(element) {
    return Element.recursivelyCollect(element, 'nextSibling');
  },

  // Find the next siblings without actually extending them all
  rawNextSiblings: function(element) {
    return $(element).rawRecursivelyCollect('nextSibling');
  },

  siblings: function(element) {
    element = $(element);
    return Element.previousSiblings(element).reverse()
      .concat(Element.nextSiblings(element));
  },

  match: function(element, selector) {
    element = $(element);
    if (Object.isString(selector))
      return Prototype.Selector.match(element, selector);
    return selector.match(element);
  },

  up: function(element, expression, index) {
    element = $(element);
    if (arguments.length == 1) return $(element.parentNode);
    var ancestors = Element.ancestors(element);
    return Object.isNumber(expression) ? ancestors[expression] :
      Prototype.Selector.find(ancestors, expression, index);
  },

  down: function(element, expression, index) {
    element = $(element);
    if (arguments.length == 1) return Element.firstDescendant(element);
    return Object.isNumber(expression) ? Element.descendants(element)[expression] :
      Element.select(element, expression)[index || 0];
  },

  previous: function(element, expression, index) {
    element = $(element);
    if (Object.isNumber(expression)) index = expression, expression = false;
    if (!Object.isNumber(index)) index = 0;

    if (expression) {
      return Prototype.Selector.find(element.previousSiblings(), expression, index);
    } else {
      return element.recursivelyCollect("previousSibling", index + 1)[index];
    }
  },

  next: function(element, expression, index) {
    element = $(element);
    if (Object.isNumber(expression)) index = expression, expression = false;
    if (!Object.isNumber(index)) index = 0;

    if (expression) {
      return Prototype.Selector.find(element.nextSiblings(), expression, index);
    } else {
      var maximumLength = Object.isNumber(index) ? index + 1 : 1;
      return element.recursivelyCollect("nextSibling", index + 1)[index];
    }
  },


  select: function(element) {
    element = $(element);
    var expressions = Array.prototype.slice.call(arguments, 1).join(', ');
    return Prototype.Selector.select(expressions, element);
  },

  adjacent: function(element) {
    element = $(element);
    var expressions = Array.prototype.slice.call(arguments, 1).join(', ');
    return Prototype.Selector.select(expressions, element.parentNode).without(element);
  },

  identify: function(element) {
    element = $(element);
    var id = Element.readAttribute(element, 'id');
    if (id) return id;
    do { id = 'anonymous_element_' + Element.idCounter++ } while ($(id));
    Element.writeAttribute(element, 'id', id);
    return id;
  },

  readAttribute: function(element, name) {
    element = $(element);
    if (Prototype.Browser.IE) {
      var t = Element._attributeTranslations.read;
      if (t.values[name]) return t.values[name](element, name);
      if (t.names[name]) name = t.names[name];
      if (name.include(':')) {
        return (!element.attributes || !element.attributes[name]) ? null :
         element.attributes[name].value;
      }
    }
    return element.getAttribute(name);
  },

  writeAttribute: function(element, name, value) {
    element = $(element);
    var attributes = { }, t = Element._attributeTranslations.write;

    if (typeof name == 'object') attributes = name;
    else attributes[name] = Object.isUndefined(value) ? true : value;

    for (var attr in attributes) {
      name = t.names[attr] || attr;
      value = attributes[attr];
      if (t.values[attr]) name = t.values[attr](element, value);
      if (value === false || value === null)
        element.removeAttribute(name);
      else if (value === true)
        element.setAttribute(name, name);
      else element.setAttribute(name, value);
    }
    return element;
  },

  getHeight: function(element) {
    return Element.getDimensions(element).height;
  },

  getWidth: function(element) {
    return Element.getDimensions(element).width;
  },

  classNames: function(element) {
    return new Element.ClassNames(element);
  },

  hasClassName: function(element, className) {
    if (!(element = $(element))) return;
    var elementClassName = element.className;
    return (elementClassName.length > 0 && (elementClassName == className ||
      new RegExp("(^|\\s)" + className + "(\\s|$)").test(elementClassName)));
  },

  addClassName: function(element, className) {
    if (!(element = $(element))) return;
    if (!Element.hasClassName(element, className))
      element.className += (element.className ? ' ' : '') + className;
    return element;
  },

  removeClassName: function(element, className) {
    if (!(element = $(element))) return;
    element.className = element.className.replace(
      new RegExp("(^|\\s+)" + className + "(\\s+|$)"), ' ').strip();
    return element;
  },

  toggleClassName: function(element, className) {
    if (!(element = $(element))) return;
    return Element[Element.hasClassName(element, className) ?
      'removeClassName' : 'addClassName'](element, className);
  },

  cleanWhitespace: function(element) {
    element = $s(element);
    var node = element.firstChild;
    while (node) {
      var nextNode = node.nextSibling;
      if (node.nodeType == 3 && !/\S/.test(node.nodeValue))
        element.removeChild(node);
      node = nextNode;
    }
    return element;
  },

  empty: function(element) {
    return $(element).innerHTML.blank();
  },

  descendantOf: function(element, ancestor) {
    element = $(element), ancestor = $(ancestor);

    if (element.compareDocumentPosition)
      return (element.compareDocumentPosition(ancestor) & 8) === 8;

    if (ancestor.contains)
      return ancestor.contains(element) && ancestor !== element;

    while (element = element.parentNode)
      if (element == ancestor) return true;

    return false;
  },

  scrollTo: function(element) {
    element = $(element);
    var pos = Element.cumulativeOffset(element);
    window.scrollTo(pos[0], pos[1]);
    return element;
  },

  getStyle: function(element, style) {
    element = $(element);
    style = style == 'float' ? 'cssFloat' : style.camelize();
    var value = element.style[style];
    if (!value || value == 'auto') {
      var css = document.defaultView.getComputedStyle(element, null);
      value = css ? css[style] : null;
    }
    if (style == 'opacity') return value ? parseFloat(value) : 1.0;
    return value == 'auto' ? null : value;
  },

  getOpacity: function(element) {
    return $(element).getStyle('opacity');
  },

  setStyle: function(element, styles) {
    element = $(element);
    var elementStyle = element.style, match;
    if (Object.isString(styles)) {
      element.style.cssText += ';' + styles;
      return styles.include('opacity') ?
        element.setOpacity(styles.match(/opacity:\s*(\d?\.?\d*)/)[1]) : element;
    }
    for (var property in styles)
      if (property == 'opacity') element.setOpacity(styles[property]);
      else
        elementStyle[(property == 'float' || property == 'cssFloat') ?
          (Object.isUndefined(elementStyle.styleFloat) ? 'cssFloat' : 'styleFloat') :
            property] = styles[property];

    return element;
  },

  setOpacity: function(element, value) {
    element = $(element);
    element.style.opacity = (value == 1 || value === '') ? '' :
      (value < 0.00001) ? 0 : value;
    return element;
  },

  makePositioned: function(element) {
    element = $s(element);
    var pos = Element.getStyle(element, 'position');
    if (pos == 'static' || !pos) {
      element._madePositioned = true;
      element.style.position = 'relative';
      if (Prototype.Browser.Opera) {
        element.style.top = 0;
        element.style.left = 0;
      }
    }
    return element;
  },

  undoPositioned: function(element) {
    element = $(element);
    if (element._madePositioned) {
      element._madePositioned = undefined;
      element.style.position =
        element.style.top =
        element.style.left =
        element.style.bottom =
        element.style.right = '';
    }
    return element;
  },

  makeClipping: function(element) {
    element = $(element);
    if (element._overflow) return element;
    element._overflow = Element.getStyle(element, 'overflow') || 'auto';
    if (element._overflow !== 'hidden')
      element.style.overflow = 'hidden';
    return element;
  },

  undoClipping: function(element) {
    element = $(element);
    if (!element._overflow) return element;
    element.style.overflow = element._overflow == 'auto' ? '' : element._overflow;
    element._overflow = null;
    return element;
  },

  clonePosition: function(element, source) {
    var options = Object.extend({
      setLeft:    true,
      setTop:     true,
      setWidth:   true,
      setHeight:  true,
      offsetTop:  0,
      offsetLeft: 0
    }, arguments[2] || { });

    source = $(source);
    var p = Element.viewportOffset(source), delta = [0, 0], parent = null;

    element = $(element);

    if (Element.getStyle(element, 'position') == 'absolute') {
      parent = Element.getOffsetParent(element);
      delta = Element.viewportOffset(parent);
    }

    if (parent == document.body) {
      delta[0] -= document.body.offsetLeft;
      delta[1] -= document.body.offsetTop;
    }

    if (options.setLeft)   element.style.left  = (p[0] - delta[0] + options.offsetLeft) + 'px';
    if (options.setTop)    element.style.top   = (p[1] - delta[1] + options.offsetTop) + 'px';
    if (options.setWidth)  element.style.width = source.offsetWidth + 'px';
    if (options.setHeight) element.style.height = source.offsetHeight + 'px';
    return element;
  }
};

Object.extend(Element.Methods, {
  getElementsBySelector: Element.Methods.select,

  childElements: Element.Methods.immediateDescendants
});

Element._attributeTranslations = {
  write: {
    names: {
      className: 'class',
      htmlFor:   'for'
    },
    values: { }
  }
};

if (Prototype.Browser.Opera) {
  Element.Methods.getStyle = Element.Methods.getStyle.wrap(
    function(proceed, element, style) {
      switch (style) {
        case 'height': case 'width':
          if (!Element.visible(element)) return null;

          var dim = parseInt(proceed(element, style), 10);

          if (dim !== element['offset' + style.capitalize()])
            return dim + 'px';

          var properties;
          if (style === 'height') {
            properties = ['border-top-width', 'padding-top',
             'padding-bottom', 'border-bottom-width'];
          }
          else {
            properties = ['border-left-width', 'padding-left',
             'padding-right', 'border-right-width'];
          }
          return properties.inject(dim, function(memo, property) {
            var val = proceed(element, property);
            return val === null ? memo : memo - parseInt(val, 10);
          }) + 'px';
        default: return proceed(element, style);
      }
    }
  );

  Element.Methods.readAttribute = Element.Methods.readAttribute.wrap(
    function(proceed, element, attribute) {
      if (attribute === 'title') return element.title;
      return proceed(element, attribute);
    }
  );
}

else if (Prototype.Browser.IE) {
  Element.Methods.getStyle = function(element, style) {
    element = $(element);
    style = (style == 'float' || style == 'cssFloat') ? 'styleFloat' : style.camelize();
    var value = element.style[style];
    if (!value && element.currentStyle) value = element.currentStyle[style];

    if (style == 'opacity') {
      if (value = (element.getStyle('filter') || '').match(/alpha\(opacity=(.*)\)/))
        if (value[1]) return parseFloat(value[1]) / 100;
      return 1.0;
    }

    if (value == 'auto') {
      if ((style == 'width' || style == 'height') && (element.getStyle('display') != 'none'))
        return element['offset' + style.capitalize()] + 'px';
      return null;
    }
    return value;
  };

  Element.Methods.setOpacity = function(element, value) {
    function stripAlpha(filter){
      return filter.replace(/alpha\([^\)]*\)/gi,'');
    }
    element = $(element);
    var currentStyle = element.currentStyle;
    if ((currentStyle && !currentStyle.hasLayout) ||
      (!currentStyle && element.style.zoom == 'normal'))
        element.style.zoom = 1;

    var filter = element.getStyle('filter'), style = element.style;
    if (value == 1 || value === '') {
      (filter = stripAlpha(filter)) ?
        style.filter = filter : style.removeAttribute('filter');
      return element;
    } else if (value < 0.00001) value = 0;
    style.filter = stripAlpha(filter) +
      'alpha(opacity=' + (value * 100) + ')';
    return element;
  };

  Element._attributeTranslations = (function(){

    var classProp = 'className',
        forProp = 'for',
        el = document.createElement('div');

    el.setAttribute(classProp, 'x');

    if (el.className !== 'x') {
      el.setAttribute('class', 'x');
      if (el.className === 'x') {
        classProp = 'class';
      }
    }
    el = null;

    el = document.createElement('label');
    el.setAttribute(forProp, 'x');
    if (el.htmlFor !== 'x') {
      el.setAttribute('htmlFor', 'x');
      if (el.htmlFor === 'x') {
        forProp = 'htmlFor';
      }
    }
    el = null;

    return {
      read: {
        names: {
          'class':      classProp,
          'className':  classProp,
          'for':        forProp,
          'htmlFor':    forProp
        },
        values: {
          _getAttr: function(element, attribute) {
            return element.getAttribute(attribute);
          },
          _getAttr2: function(element, attribute) {
            return element.getAttribute(attribute, 2);
          },
          _getAttrNode: function(element, attribute) {
            var node = element.getAttributeNode(attribute);
            return node ? node.value : "";
          },
          _getEv: (function(){

            var el = document.createElement('div'), f;
            el.onclick = Prototype.emptyFunction;
            var value = el.getAttribute('onclick');

            if (String(value).indexOf('{') > -1) {
              f = function(element, attribute) {
                attribute = element.getAttribute(attribute);
                if (!attribute) return null;
                attribute = attribute.toString();
                attribute = attribute.split('{')[1];
                attribute = attribute.split('}')[0];
                return attribute.strip();
              };
            }
            else if (value === '') {
              f = function(element, attribute) {
                attribute = element.getAttribute(attribute);
                if (!attribute) return null;
                return attribute.strip();
              };
            }
            el = null;
            return f;
          })(),
          _flag: function(element, attribute) {
            return $(element).hasAttribute(attribute) ? attribute : null;
          },
          style: function(element) {
            return element.style.cssText.toLowerCase();
          },
          title: function(element) {
            return element.title;
          }
        }
      }
    }
  })();

  Element._attributeTranslations.write = {
    names: Object.extend({
      cellpadding: 'cellPadding',
      cellspacing: 'cellSpacing'
    }, Element._attributeTranslations.read.names),
    values: {
      checked: function(element, value) {
        element.checked = !!value;
      },

      style: function(element, value) {
        element.style.cssText = value ? value : '';
      }
    }
  };

  Element._attributeTranslations.has = {};

  $w('colSpan rowSpan vAlign dateTime accessKey tabIndex ' +
      'encType maxLength readOnly longDesc frameBorder').each(function(attr) {
    Element._attributeTranslations.write.names[attr.toLowerCase()] = attr;
    Element._attributeTranslations.has[attr.toLowerCase()] = attr;
  });

  (function(v) {
    Object.extend(v, {
      href:        v._getAttr2,
      src:         v._getAttr2,
      type:        v._getAttr,
      action:      v._getAttrNode,
      disabled:    v._flag,
      checked:     v._flag,
      readonly:    v._flag,
      multiple:    v._flag,
      onload:      v._getEv,
      onunload:    v._getEv,
      onclick:     v._getEv,
      ondblclick:  v._getEv,
      onmousedown: v._getEv,
      onmouseup:   v._getEv,
      onmouseover: v._getEv,
      onmousemove: v._getEv,
      onmouseout:  v._getEv,
      onfocus:     v._getEv,
      onblur:      v._getEv,
      onkeypress:  v._getEv,
      onkeydown:   v._getEv,
      onkeyup:     v._getEv,
      onsubmit:    v._getEv,
      onreset:     v._getEv,
      onselect:    v._getEv,
      onchange:    v._getEv
    });
  })(Element._attributeTranslations.read.values);

  if (Prototype.BrowserFeatures.ElementExtensions) {
    (function() {
      function _descendants(element) {
        var nodes = element.getElementsByTagName('*'), results = [];
        for (var i = 0, node; node = nodes[i]; i++)
          if (node.tagName !== "!") // Filter out comment nodes.
            results.push(node);
        return results;
      }

      Element.Methods.down = function(element, expression, index) {
        element = $(element);
        if (arguments.length == 1) return element.firstDescendant();
        return Object.isNumber(expression) ? _descendants(element)[expression] :
          Element.select(element, expression)[index || 0];
      }
    })();
  }

}

else if (Prototype.Browser.Gecko && /rv:1\.8\.0/.test(navigator.userAgent)) {
  Element.Methods.setOpacity = function(element, value) {
    element = $(element);
    element.style.opacity = (value == 1) ? 0.999999 :
      (value === '') ? '' : (value < 0.00001) ? 0 : value;
    return element;
  };
}

else if (Prototype.Browser.WebKit) {
  Element.Methods.setOpacity = function(element, value) {
    element = $(element);
    element.style.opacity = (value == 1 || value === '') ? '' :
      (value < 0.00001) ? 0 : value;

    if (value == 1)
      if (element.tagName.toUpperCase() == 'IMG' && element.width) {
        element.width++; element.width--;
      } else try {
        var n = document.createTextNode(' ');
        element.appendChild(n);
        element.removeChild(n);
      } catch (e) { }

    return element;
  };
}

if ('outerHTML' in document.documentElement) {
  Element.Methods.replace = function(element, content) {
    element = $(element);

    if (content && content.toElement) content = content.toElement();
    if (Object.isElement(content)) {
      element.parentNode.replaceChild(content, element);
      return element;
    }

    content = Object.toHTML(content);
    var parent = element.parentNode, tagName = parent.tagName.toUpperCase();

    if (Element._insertionTranslations.tags[tagName]) {
      var nextSibling = element.next(),
          fragments = Element._getContentFromAnonymousElement(tagName, content.stripScripts());
      parent.removeChild(element);
      if (nextSibling)
        fragments.each(function(node) { parent.insertBefore(node, nextSibling) });
      else
        fragments.each(function(node) { parent.appendChild(node) });
    }
    else element.outerHTML = content.stripScripts();

    content.evalScripts.bind(content).defer();
    return element;
  };
}

Element._returnOffset = function(l, t) {
  var result = [l, t];
  result.left = l;
  result.top = t;
  return result;
};

Element._getContentFromAnonymousElement = function(tagName, html, force) {
  var div = new Element('div'),
      t = Element._insertionTranslations.tags[tagName];

  var workaround = false;
  if (t) workaround = true;
  else if (force) {
    workaround = true;
    t = ['', '', 0];
  }

  if (workaround) {
    div.innerHTML = '&nbsp;' + t[0] + html + t[1];
    div.removeChild(div.firstChild);
    for (var i = t[2]; i--; ) {
      div = div.firstChild;
    }
  }
  else {
    div.innerHTML = html;
  }
  return $A(div.childNodes);
};

Element._insertionTranslations = {
  before: function(element, node) {
    element.parentNode.insertBefore(node, element);
  },
  top: function(element, node) {
    element.insertBefore(node, element.firstChild);
  },
  bottom: function(element, node) {
    element.appendChild(node);
  },
  after: function(element, node) {
    element.parentNode.insertBefore(node, element.nextSibling);
  },
  tags: {
    TABLE:  ['<table>',                '</table>',                   1],
    TBODY:  ['<table><tbody>',         '</tbody></table>',           2],
    TR:     ['<table><tbody><tr>',     '</tr></tbody></table>',      3],
    TD:     ['<table><tbody><tr><td>', '</td></tr></tbody></table>', 4],
    SELECT: ['<select>',               '</select>',                  1]
  }
};

(function() {
  var tags = Element._insertionTranslations.tags;
  Object.extend(tags, {
    THEAD: tags.TBODY,
    TFOOT: tags.TBODY,
    TH:    tags.TD
  });
})();

Element.Methods.Simulated = {
  hasAttribute: function(element, attribute) {
    attribute = Element._attributeTranslations.has[attribute] || attribute;
    var node = $(element).getAttributeNode(attribute);
    return !!(node && node.specified);
  }
};

Element.Methods.ByTag = { };

Object.extend(Element, Element.Methods);

(function(div) {

  if (!Prototype.BrowserFeatures.ElementExtensions && div['__proto__']) {
    window.HTMLElement = { };
    window.HTMLElement.prototype = div['__proto__'];
    Prototype.BrowserFeatures.ElementExtensions = true;
  }

  div = null;

})(document.createElement('div'));

Element.extend = (function() {

  function checkDeficiency(tagName) {
    if (typeof window.Element != 'undefined') {
      var proto = window.Element.prototype;
      if (proto) {
        var id = '_' + (Math.random()+'').slice(2),
            el = document.createElement(tagName);
        proto[id] = 'x';
        var isBuggy = (el[id] !== 'x');
        delete proto[id];
        el = null;
        return isBuggy;
      }
    }
    return false;
  }

  function extendElementWith(element, methods) {
    for (var property in methods) {
      var value = methods[property];
      if (Object.isFunction(value) && !(property in element))
        element[property] = value.methodize();
    }
  }

  var HTMLOBJECTELEMENT_PROTOTYPE_BUGGY = checkDeficiency('object');

  if (Prototype.BrowserFeatures.SpecificElementExtensions) {
    if (HTMLOBJECTELEMENT_PROTOTYPE_BUGGY) {
      return function(element) {
        if (element && typeof element._extendedByPrototype == 'undefined') {
          var t = element.tagName;
          if (t && (/^(?:object|applet|embed)$/i.test(t))) {
            extendElementWith(element, Element.Methods);
            extendElementWith(element, Element.Methods.Simulated);
            extendElementWith(element, Element.Methods.ByTag[t.toUpperCase()]);
          }
        }
        return element;
      }
    }
    return Prototype.K;
  }

  var Methods = { }, ByTag = Element.Methods.ByTag;

  var extend = Object.extend(function(element) {
    if (!element || typeof element._extendedByPrototype != 'undefined' ||
        element.nodeType != 1 || element == window) return element;

    var methods = Object.clone(Methods),
        tagName = element.tagName.toUpperCase();

    if (ByTag[tagName]) Object.extend(methods, ByTag[tagName]);

    extendElementWith(element, methods);

    element._extendedByPrototype = Prototype.emptyFunction;
    return element;

  }, {
    refresh: function() {
      if (!Prototype.BrowserFeatures.ElementExtensions) {
        Object.extend(Methods, Element.Methods);
        Object.extend(Methods, Element.Methods.Simulated);
      }
    }
  });

  extend.refresh();
  return extend;
})();

if (document.documentElement.hasAttribute) {
  Element.hasAttribute = function(element, attribute) {
    return element.hasAttribute(attribute);
  };
}
else {
  Element.hasAttribute = Element.Methods.Simulated.hasAttribute;
}

Element.addMethods = function(methods) {
  var F = Prototype.BrowserFeatures, T = Element.Methods.ByTag;

  if (!methods) {
    Object.extend(Form, Form.Methods);
    Object.extend(Form.Element, Form.Element.Methods);
    Object.extend(Element.Methods.ByTag, {
      "FORM":     Object.clone(Form.Methods),
      "INPUT":    Object.clone(Form.Element.Methods),
      "SELECT":   Object.clone(Form.Element.Methods),
      "TEXTAREA": Object.clone(Form.Element.Methods),
      "BUTTON":   Object.clone(Form.Element.Methods)
    });
  }

  if (arguments.length == 2) {
    var tagName = methods;
    methods = arguments[1];
  }

  if (!tagName) Object.extend(Element.Methods, methods || { });
  else {
    if (Object.isArray(tagName)) tagName.each(extend);
    else extend(tagName);
  }

  function extend(tagName) {
    tagName = tagName.toUpperCase();
    if (!Element.Methods.ByTag[tagName])
      Element.Methods.ByTag[tagName] = { };
    Object.extend(Element.Methods.ByTag[tagName], methods);
  }

  function copy(methods, destination, onlyIfAbsent) {
    onlyIfAbsent = onlyIfAbsent || false;
    for (var property in methods) {
      var value = methods[property];
      if (!Object.isFunction(value)) continue;
      if (!onlyIfAbsent || !(property in destination))
        destination[property] = value.methodize();
    }
  }

  function findDOMClass(tagName) {
    var klass;
    var trans = {
      "OPTGROUP": "OptGroup", "TEXTAREA": "TextArea", "P": "Paragraph",
      "FIELDSET": "FieldSet", "UL": "UList", "OL": "OList", "DL": "DList",
      "DIR": "Directory", "H1": "Heading", "H2": "Heading", "H3": "Heading",
      "H4": "Heading", "H5": "Heading", "H6": "Heading", "Q": "Quote",
      "INS": "Mod", "DEL": "Mod", "A": "Anchor", "IMG": "Image", "CAPTION":
      "TableCaption", "COL": "TableCol", "COLGROUP": "TableCol", "THEAD":
      "TableSection", "TFOOT": "TableSection", "TBODY": "TableSection", "TR":
      "TableRow", "TH": "TableCell", "TD": "TableCell", "FRAMESET":
      "FrameSet", "IFRAME": "IFrame"
    };
    if (trans[tagName]) klass = 'HTML' + trans[tagName] + 'Element';
    if (window[klass]) return window[klass];
    klass = 'HTML' + tagName + 'Element';
    if (window[klass]) return window[klass];
    klass = 'HTML' + tagName.capitalize() + 'Element';
    if (window[klass]) return window[klass];

    var element = document.createElement(tagName),
        proto = element['__proto__'] || element.constructor.prototype;

    element = null;
    return proto;
  }

  var elementPrototype = window.HTMLElement ? HTMLElement.prototype :
   Element.prototype;

  if (F.ElementExtensions) {
    copy(Element.Methods, elementPrototype);
    copy(Element.Methods.Simulated, elementPrototype, true);
  }

  if (F.SpecificElementExtensions) {
    for (var tag in Element.Methods.ByTag) {
      var klass = findDOMClass(tag);
      if (Object.isUndefined(klass)) continue;
      copy(T[tag], klass.prototype);
    }
  }

  Object.extend(Element, Element.Methods);
  delete Element.ByTag;

  if (Element.extend.refresh) Element.extend.refresh();
  Element.cache = { };
};


document.viewport = {

  getDimensions: function() {
    return { width: this.getWidth(), height: this.getHeight() };
  },

  getScrollOffsets: function() {
    return Element._returnOffset(
      window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft,
      window.pageYOffset || document.documentElement.scrollTop  || document.body.scrollTop);
  }
};

(function(viewport) {
  var B = Prototype.Browser, doc = document, element, property = {};

  function getRootElement() {
    if (B.WebKit && !doc.evaluate)
      return document;

    if (B.Opera && window.parseFloat(window.opera.version()) < 9.5)
      return document.body;

    return document.documentElement;
  }

  function define(D) {
    if (!element) element = getRootElement();

    property[D] = 'client' + D;

    viewport['get' + D] = function() { return element[property[D]] };
    return viewport['get' + D]();
  }

  viewport.getWidth  = define.curry('Width');

  viewport.getHeight = define.curry('Height');
})(document.viewport);


Element.Storage = {
  UID: 1
};

Element.addMethods({
  getStorage: function(element) {
    if (!(element = $(element))) return;

    var uid;
    if (element === window) {
      uid = 0;
    } else {
      if (typeof element._prototypeUID === "undefined")
        element._prototypeUID = Element.Storage.UID++;
      uid = element._prototypeUID;
    }

    if (!Element.Storage[uid])
      Element.Storage[uid] = $H();

    return Element.Storage[uid];
  },

  store: function(element, key, value) {
    if (!(element = $(element))) return;

    if (arguments.length === 2) {
      Element.getStorage(element).update(key);
    } else {
      Element.getStorage(element).set(key, value);
    }

    return element;
  },

  retrieve: function(element, key, defaultValue) {
    if (!(element = $(element))) return;
    var hash = Element.getStorage(element), value = hash.get(key);

    if (Object.isUndefined(value)) {
      hash.set(key, defaultValue);
      value = defaultValue;
    }

    return value;
  },

  clone: function(element, deep) {
    if (!(element = $(element))) return;
    var clone = element.cloneNode(deep);
    clone._prototypeUID = void 0;
    if (deep) {
      var descendants = Element.select(clone, '*'),
          i = descendants.length;
      while (i--) {
        descendants[i]._prototypeUID = void 0;
      }
    }
    return Element.extend(clone);
  },

  purge: function(element) {
    if (!(element = $(element))) return;
    var purgeElement = Element._purgeElement;

    purgeElement(element);

    var descendants = element.getElementsByTagName('*'),
     i = descendants.length;

    while (i--) purgeElement(descendants[i]);

    return null;
  }
});

(function() {

  function toDecimal(pctString) {
    var match = pctString.match(/^(\d+)%?$/i);
    if (!match) return null;
    return (Number(match[1]) / 100);
  }

  function getPixelValue(value, property, context) {
    var element = null;
    if (Object.isElement(value)) {
      element = value;
      value = element.getStyle(property);
    }

    if (value === null) {
      return null;
    }

    if ((/^(?:-)?\d+(\.\d+)?(px)?$/i).test(value)) {
      return window.parseFloat(value);
    }

    var isPercentage = value.include('%'), isViewport = (context === document.viewport);

    if (/\d/.test(value) && element && element.runtimeStyle && !(isPercentage && isViewport)) {
      var style = element.style.left, rStyle = element.runtimeStyle.left;
      element.runtimeStyle.left = element.currentStyle.left;
      element.style.left = value || 0;
      value = element.style.pixelLeft;
      element.style.left = style;
      element.runtimeStyle.left = rStyle;

      return value;
    }

    if (element && isPercentage) {
      context = context || element.parentNode;
      var decimal = toDecimal(value);
      var whole = null;
      var position = element.getStyle('position');

      var isHorizontal = property.include('left') || property.include('right') ||
       property.include('width');

      var isVertical =  property.include('top') || property.include('bottom') ||
        property.include('height');

      if (context === document.viewport) {
        if (isHorizontal) {
          whole = document.viewport.getWidth();
        } else if (isVertical) {
          whole = document.viewport.getHeight();
        }
      } else {
        if (isHorizontal) {
          whole = $(context).measure('width');
        } else if (isVertical) {
          whole = $(context).measure('height');
        }
      }

      return (whole === null) ? 0 : whole * decimal;
    }

    return 0;
  }

  function toCSSPixels(number) {
    if (Object.isString(number) && number.endsWith('px')) {
      return number;
    }
    return number + 'px';
  }

  function isDisplayed(element) {
    var originalElement = element;
    while (element && element.parentNode) {
      var display = element.getStyle('display');
      if (display === 'none') {
        return false;
      }
      element = $(element.parentNode);
    }
    return true;
  }

  var hasLayout = Prototype.K;
  if ('currentStyle' in document.documentElement) {
    hasLayout = function(element) {
      if (!element.currentStyle.hasLayout) {
        element.style.zoom = 1;
      }
      return element;
    };
  }

  function cssNameFor(key) {
    if (key.include('border')) key = key + '-width';
    return key.camelize();
  }

  Element.Layout = Class.create(Hash, {
    initialize: function($super, element, preCompute) {
      $super();
      this.element = $(element);

      Element.Layout.PROPERTIES.each( function(property) {
        this._set(property, null);
      }, this);

      if (preCompute) {
        this._preComputing = true;
        this._begin();
        Element.Layout.PROPERTIES.each( this._compute, this );
        this._end();
        this._preComputing = false;
      }
    },

    _set: function(property, value) {
      return Hash.prototype.set.call(this, property, value);
    },

    set: function(property, value) {
      throw "Properties of Element.Layout are read-only.";
    },

    get: function($super, property) {
      var value = $super(property);
      return value === null ? this._compute(property) : value;
    },

    _begin: function() {
      if (this._prepared) return;

      var element = this.element;
      if (isDisplayed(element)) {
        this._prepared = true;
        return;
      }

      var originalStyles = {
        position:   element.style.position   || '',
        width:      element.style.width      || '',
        visibility: element.style.visibility || '',
        display:    element.style.display    || ''
      };

      element.store('prototype_original_styles', originalStyles);

      var position = element.getStyle('position'),
       width = element.getStyle('width');

      if (width === "0px" || width === null) {
        element.style.display = 'block';
        width = element.getStyle('width');
      }

      var context = (position === 'fixed') ? document.viewport :
       element.parentNode;

      element.setStyle({
        position:   'absolute',
        visibility: 'hidden',
        display:    'block'
      });

      var positionedWidth = element.getStyle('width');

      var newWidth;
      if (width && (positionedWidth === width)) {
        newWidth = getPixelValue(element, 'width', context);
      } else if (position === 'absolute' || position === 'fixed') {
        newWidth = getPixelValue(element, 'width', context);
      } else {
        var parent = element.parentNode, pLayout = $(parent).getLayout();

        newWidth = pLayout.get('width') -
         this.get('margin-left') -
         this.get('border-left') -
         this.get('padding-left') -
         this.get('padding-right') -
         this.get('border-right') -
         this.get('margin-right');
      }

      element.setStyle({ width: newWidth + 'px' });

      this._prepared = true;
    },

    _end: function() {
      var element = this.element;
      var originalStyles = element.retrieve('prototype_original_styles');
      element.store('prototype_original_styles', null);
      element.setStyle(originalStyles);
      this._prepared = false;
    },

    _compute: function(property) {
      var COMPUTATIONS = Element.Layout.COMPUTATIONS;
      if (!(property in COMPUTATIONS)) {
        throw "Property not found.";
      }

      return this._set(property, COMPUTATIONS[property].call(this, this.element));
    },

    toObject: function() {
      var args = $A(arguments);
      var keys = (args.length === 0) ? Element.Layout.PROPERTIES :
       args.join(' ').split(' ');
      var obj = {};
      keys.each( function(key) {
        if (!Element.Layout.PROPERTIES.include(key)) return;
        var value = this.get(key);
        if (value != null) obj[key] = value;
      }, this);
      return obj;
    },

    toHash: function() {
      var obj = this.toObject.apply(this, arguments);
      return new Hash(obj);
    },

    toCSS: function() {
      var args = $A(arguments);
      var keys = (args.length === 0) ? Element.Layout.PROPERTIES :
       args.join(' ').split(' ');
      var css = {};

      keys.each( function(key) {
        if (!Element.Layout.PROPERTIES.include(key)) return;
        if (Element.Layout.COMPOSITE_PROPERTIES.include(key)) return;

        var value = this.get(key);
        if (value != null) css[cssNameFor(key)] = value + 'px';
      }, this);
      return css;
    },

    inspect: function() {
      return "#<Element.Layout>";
    }
  });

  Object.extend(Element.Layout, {
    PROPERTIES: $w('height width top left right bottom border-left border-right border-top border-bottom padding-left padding-right padding-top padding-bottom margin-top margin-bottom margin-left margin-right padding-box-width padding-box-height border-box-width border-box-height margin-box-width margin-box-height'),

    COMPOSITE_PROPERTIES: $w('padding-box-width padding-box-height margin-box-width margin-box-height border-box-width border-box-height'),

    COMPUTATIONS: {
      'height': function(element) {
        if (!this._preComputing) this._begin();

        var bHeight = this.get('border-box-height');
        if (bHeight <= 0) {
          if (!this._preComputing) this._end();
          return 0;
        }

        var bTop = this.get('border-top'),
         bBottom = this.get('border-bottom');

        var pTop = this.get('padding-top'),
         pBottom = this.get('padding-bottom');

        if (!this._preComputing) this._end();

        return bHeight - bTop - bBottom - pTop - pBottom;
      },

      'width': function(element) {
        if (!this._preComputing) this._begin();

        var bWidth = this.get('border-box-width');
        if (bWidth <= 0) {
          if (!this._preComputing) this._end();
          return 0;
        }

        var bLeft = this.get('border-left'),
         bRight = this.get('border-right');

        var pLeft = this.get('padding-left'),
         pRight = this.get('padding-right');

        if (!this._preComputing) this._end();

        return bWidth - bLeft - bRight - pLeft - pRight;
      },

      'padding-box-height': function(element) {
        var height = this.get('height'),
         pTop = this.get('padding-top'),
         pBottom = this.get('padding-bottom');

        return height + pTop + pBottom;
      },

      'padding-box-width': function(element) {
        var width = this.get('width'),
         pLeft = this.get('padding-left'),
         pRight = this.get('padding-right');

        return width + pLeft + pRight;
      },

      'border-box-height': function(element) {
        if (!this._preComputing) this._begin();
        var height = element.offsetHeight;
        if (!this._preComputing) this._end();
        return height;
      },

      'border-box-width': function(element) {
        if (!this._preComputing) this._begin();
        var width = element.offsetWidth;
        if (!this._preComputing) this._end();
        return width;
      },

      'margin-box-height': function(element) {
        var bHeight = this.get('border-box-height'),
         mTop = this.get('margin-top'),
         mBottom = this.get('margin-bottom');

        if (bHeight <= 0) return 0;

        return bHeight + mTop + mBottom;
      },

      'margin-box-width': function(element) {
        var bWidth = this.get('border-box-width'),
         mLeft = this.get('margin-left'),
         mRight = this.get('margin-right');

        if (bWidth <= 0) return 0;

        return bWidth + mLeft + mRight;
      },

      'top': function(element) {
        var offset = element.positionedOffset();
        return offset.top;
      },

      'bottom': function(element) {
        var offset = element.positionedOffset(),
         parent = element.getOffsetParent(),
         pHeight = parent.measure('height');

        var mHeight = this.get('border-box-height');

        return pHeight - mHeight - offset.top;
      },

      'left': function(element) {
        var offset = element.positionedOffset();
        return offset.left;
      },

      'right': function(element) {
        var offset = element.positionedOffset(),
         parent = element.getOffsetParent(),
         pWidth = parent.measure('width');

        var mWidth = this.get('border-box-width');

        return pWidth - mWidth - offset.left;
      },

      'padding-top': function(element) {
        return getPixelValue(element, 'paddingTop');
      },

      'padding-bottom': function(element) {
        return getPixelValue(element, 'paddingBottom');
      },

      'padding-left': function(element) {
        return getPixelValue(element, 'paddingLeft');
      },

      'padding-right': function(element) {
        return getPixelValue(element, 'paddingRight');
      },

      'border-top': function(element) {
        return getPixelValue(element, 'borderTopWidth');
      },

      'border-bottom': function(element) {
        return getPixelValue(element, 'borderBottomWidth');
      },

      'border-left': function(element) {
        return getPixelValue(element, 'borderLeftWidth');
      },

      'border-right': function(element) {
        return getPixelValue(element, 'borderRightWidth');
      },

      'margin-top': function(element) {
        return getPixelValue(element, 'marginTop');
      },

      'margin-bottom': function(element) {
        return getPixelValue(element, 'marginBottom');
      },

      'margin-left': function(element) {
        return getPixelValue(element, 'marginLeft');
      },

      'margin-right': function(element) {
        return getPixelValue(element, 'marginRight');
      }
    }
  });

  if ('getBoundingClientRect' in document.documentElement) {
    Object.extend(Element.Layout.COMPUTATIONS, {
      'right': function(element) {
        var parent = hasLayout(element.getOffsetParent());
        var rect = element.getBoundingClientRect(),
         pRect = parent.getBoundingClientRect();

        return (pRect.right - rect.right).round();
      },

      'bottom': function(element) {
        var parent = hasLayout(element.getOffsetParent());
        var rect = element.getBoundingClientRect(),
         pRect = parent.getBoundingClientRect();

        return (pRect.bottom - rect.bottom).round();
      }
    });
  }

  Element.Offset = Class.create({
    initialize: function(left, top) {
      this.left = left.round();
      this.top  = top.round();

      this[0] = this.left;
      this[1] = this.top;
    },

    relativeTo: function(offset) {
      return new Element.Offset(
        this.left - offset.left,
        this.top  - offset.top
      );
    },

    inspect: function() {
      return "#<Element.Offset left: #{left} top: #{top}>".interpolate(this);
    },

    toString: function() {
      return "[#{left}, #{top}]".interpolate(this);
    },

    toArray: function() {
      return [this.left, this.top];
    }
  });

  function getLayout(element, preCompute) {
    return new Element.Layout(element, preCompute);
  }

  function measure(element, property) {
    return $(element).getLayout().get(property);
  }

  function getDimensions(element) {
    element = $(element);
    var display = Element.getStyle(element, 'display');

    if (display && display !== 'none') {
      return { width: element.offsetWidth, height: element.offsetHeight };
    }

    var style = element.style;
    var originalStyles = {
      visibility: style.visibility,
      position:   style.position,
      display:    style.display
    };

    var newStyles = {
      visibility: 'hidden',
      display:    'block'
    };

    if (originalStyles.position !== 'fixed')
      newStyles.position = 'absolute';

    Element.setStyle(element, newStyles);

    var dimensions = {
      width:  element.offsetWidth,
      height: element.offsetHeight
    };

    Element.setStyle(element, originalStyles);

    return dimensions;
  }

  // Implementing a new method to avoid retesting the entire application with clientHeight
  function getDimensionsEx(element) {
    element = $(element);
    var display = Element.getStyle(element, 'display');
    if (display && display != 'none') { // Safari bug
      return {width: element.clientWidth, height: element.clientHeight};
    }
    return getDimensions(element);
  }

  function getOffsetParent(element) {
    element = $(element);

    if (isDocument(element) || isDetached(element) || isBody(element) || isHtml(element))
      return $(document.body);

    var isInline = (Element.getStyle(element, 'display') === 'inline');
    if (!isInline && element.offsetParent) return $(element.offsetParent);

    while ((element = element.parentNode) && element !== document.body) {
      if (Element.getStyle(element, 'position') !== 'static') {
        return isHtml(element) ? $(document.body) : $(element);
      }
    }

    return $(document.body);
  }


  function cumulativeOffset(element) {
    element = $(element);
    var valueT = 0, valueL = 0;
    if (element.parentNode) {
      do {
        valueT += element.offsetTop  || 0;
        valueL += element.offsetLeft || 0;
        element = element.offsetParent;
      } while (element);
    }
    return new Element.Offset(valueL, valueT);
  }

  function positionedOffset(element) {
    element = $(element);

    var layout = element.getLayout();

    var valueT = 0, valueL = 0;
    do {
      valueT += element.offsetTop  || 0;
      valueL += element.offsetLeft || 0;
      element = element.offsetParent;
      if (element) {
        if (isBody(element)) break;
        var p = Element.getStyle(element, 'position');
        if (p !== 'static') break;
      }
    } while (element);

    valueL -= layout.get('margin-top');
    valueT -= layout.get('margin-left');

    return new Element.Offset(valueL, valueT);
  }

  function cumulativeScrollOffset(element) {
    var valueT = 0, valueL = 0;
    do {
      valueT += element.scrollTop  || 0;
      valueL += element.scrollLeft || 0;
      element = element.parentNode;
    } while (element);
    return new Element.Offset(valueL, valueT);
  }

  function viewportOffset(forElement) {
    element = $(element);
    var valueT = 0, valueL = 0, docBody = document.body;

    var element = forElement;
    do {
      valueT += element.offsetTop  || 0;
      valueL += element.offsetLeft || 0;
      if (element.offsetParent == docBody &&
        Element.getStyle(element, 'position') == 'absolute') break;
    } while (element = element.offsetParent);

    element = forElement;
    do {
      if (element != docBody) {
        valueT -= element.scrollTop  || 0;
        valueL -= element.scrollLeft || 0;
      }
    } while (element = element.parentNode);
    return new Element.Offset(valueL, valueT);
  }

  function absolutize(element) {
    element = $(element);

    if (Element.getStyle(element, 'position') === 'absolute') {
      return element;
    }

    var offsetParent = getOffsetParent(element);
    var eOffset = element.viewportOffset(),
     pOffset = offsetParent.viewportOffset();

    var offset = eOffset.relativeTo(pOffset);
    var layout = element.getLayout();

    element.store('prototype_absolutize_original_styles', {
      left:   element.getStyle('left'),
      top:    element.getStyle('top'),
      width:  element.getStyle('width'),
      height: element.getStyle('height')
    });

    element.setStyle({
      position: 'absolute',
      top:    offset.top + 'px',
      left:   offset.left + 'px',
      width:  layout.get('width') + 'px',
      height: layout.get('height') + 'px'
    });

    return element;
  }

  function relativize(element) {
    element = $(element);
    if (Element.getStyle(element, 'position') === 'relative') {
      return element;
    }

    var originalStyles =
     element.retrieve('prototype_absolutize_original_styles');

    if (originalStyles) element.setStyle(originalStyles);
    return element;
  }

  if (Prototype.Browser.IE) {
    getOffsetParent = getOffsetParent.wrap(
      function(proceed, element) {
        element = $(element);

        if (isDocument(element) || isDetached(element) || isBody(element) || isHtml(element))
          return $(document.body);

        var position = element.getStyle('position');
        if (position !== 'static') return proceed(element);

        element.setStyle({ position: 'relative' });
        var value = proceed(element);
        element.setStyle({ position: position });
        return value;
      }
    );

    positionedOffset = positionedOffset.wrap(function(proceed, element) {
      element = $(element);
      if (!element.parentNode) return new Element.Offset(0, 0);
      var position = element.getStyle('position');
      if (position !== 'static') return proceed(element);

      var offsetParent = element.getOffsetParent();
      if (offsetParent && offsetParent.getStyle('position') === 'fixed')
        hasLayout(offsetParent);

      element.setStyle({ position: 'relative' });
      var value = proceed(element);
      element.setStyle({ position: position });
      return value;
    });
  } else if (Prototype.Browser.Webkit) {
    cumulativeOffset = function(element) {
      element = $(element);
      var valueT = 0, valueL = 0;
      do {
        valueT += element.offsetTop  || 0;
        valueL += element.offsetLeft || 0;
        if (element.offsetParent == document.body)
          if (Element.getStyle(element, 'position') == 'absolute') break;

        element = element.offsetParent;
      } while (element);

      return new Element.Offset(valueL, valueT);
    };
  }


  Element.addMethods({
    getLayout:              getLayout,
    measure:                measure,
    getDimensions:          getDimensions,
    getDimensionsEx:        getDimensionsEx,
    getOffsetParent:        getOffsetParent,
    cumulativeOffset:       cumulativeOffset,
    positionedOffset:       positionedOffset,
    cumulativeScrollOffset: cumulativeScrollOffset,
    viewportOffset:         viewportOffset,
    absolutize:             absolutize,
    relativize:             relativize
  });

  function isBody(element) {
    return element.nodeName.toUpperCase() === 'BODY';
  }

  function isHtml(element) {
    return element.nodeName.toUpperCase() === 'HTML';
  }

  function isDocument(element) {
    return element.nodeType === Node.DOCUMENT_NODE;
  }

  function isDetached(element) {
    return element !== document.body &&
     !Element.descendantOf(element, document.body);
  }

  if ('getBoundingClientRect' in document.documentElement) {
    Element.addMethods({
      viewportOffset: function(element) {
        element = $(element);
        if (isDetached(element)) return new Element.Offset(0, 0);

        var rect = element.getBoundingClientRect(),
         docEl = document.documentElement;
        return new Element.Offset(rect.left - docEl.clientLeft,
         rect.top - docEl.clientTop);
      }
    });
  }
})();
window.$$ = function() {
  var expression = $A(arguments).join(', ');
  return Prototype.Selector.select(expression, document);
};

Prototype.Selector = (function() {

  function select() {
    throw new Error('Method "Prototype.Selector.select" must be defined.');
  }

  function match() {
    throw new Error('Method "Prototype.Selector.match" must be defined.');
  }

  function find(elements, expression, index) {
    index = index || 0;
    var match = Prototype.Selector.match, length = elements.length, matchIndex = 0, i;

    for (i = 0; i < length; i++) {
      if (match(elements[i], expression) && index == matchIndex++) {
        return Element.extend(elements[i]);
      }
    }
  }

  function extendElements(elements) {
    for (var i = 0, length = elements.length; i < length; i++) {
      Element.extend(elements[i]);
    }
    return elements;
  }


  var K = Prototype.K;

  return {
    select: select,
    match: match,
    find: find,
    extendElements: (Element.extend === K) ? K : extendElements,
    extendElement: Element.extend
  };
})();
Prototype._original_property = window.Sizzle;
/*!
 * Sizzle CSS Selector Engine - v1.0
 *  Copyright 2009, The Dojo Foundation
 *  Released under the MIT, BSD, and GPL Licenses.
 *  More information: http://sizzlejs.com/
 */
(function(){

var chunker = /((?:\((?:\([^()]+\)|[^()]+)+\)|\[(?:\[[^[\]]*\]|['"][^'"]*['"]|[^[\]'"]+)+\]|\\.|[^ >+~,(\[\\]+)+|[>+~])(\s*,\s*)?((?:.|\r|\n)*)/g,
	done = 0,
	toString = Object.prototype.toString,
	hasDuplicate = false,
	baseHasDuplicate = true;

[0, 0].sort(function(){
	baseHasDuplicate = false;
	return 0;
});

var Sizzle = function(selector, context, results, seed) {
	results = results || [];
	var origContext = context = context || document;

	if ( context.nodeType !== 1 && context.nodeType !== 9 ) {
		return [];
	}

	if ( !selector || typeof selector !== "string" ) {
		return results;
	}

	var parts = [], m, set, checkSet, check, mode, extra, prune = true, contextXML = isXML(context),
		soFar = selector;

	while ( (chunker.exec(""), m = chunker.exec(soFar)) !== null ) {
		soFar = m[3];

		parts.push( m[1] );

		if ( m[2] ) {
			extra = m[3];
			break;
		}
	}

	if ( parts.length > 1 && origPOS.exec( selector ) ) {
		if ( parts.length === 2 && Expr.relative[ parts[0] ] ) {
			set = posProcess( parts[0] + parts[1], context );
		} else {
			set = Expr.relative[ parts[0] ] ?
				[ context ] :
				Sizzle( parts.shift(), context );

			while ( parts.length ) {
				selector = parts.shift();

				if ( Expr.relative[ selector ] )
					selector += parts.shift();

				set = posProcess( selector, set );
			}
		}
	} else {
		if ( !seed && parts.length > 1 && context.nodeType === 9 && !contextXML &&
				Expr.match.ID.test(parts[0]) && !Expr.match.ID.test(parts[parts.length - 1]) ) {
			var ret = Sizzle.find( parts.shift(), context, contextXML );
			context = ret.expr ? Sizzle.filter( ret.expr, ret.set )[0] : ret.set[0];
		}

		if ( context ) {
			var ret = seed ?
				{ expr: parts.pop(), set: makeArray(seed) } :
				Sizzle.find( parts.pop(), parts.length === 1 && (parts[0] === "~" || parts[0] === "+") && context.parentNode ? context.parentNode : context, contextXML );
			set = ret.expr ? Sizzle.filter( ret.expr, ret.set ) : ret.set;

			if ( parts.length > 0 ) {
				checkSet = makeArray(set);
			} else {
				prune = false;
			}

			while ( parts.length ) {
				var cur = parts.pop(), pop = cur;

				if ( !Expr.relative[ cur ] ) {
					cur = "";
				} else {
					pop = parts.pop();
				}

				if ( pop == null ) {
					pop = context;
				}

				Expr.relative[ cur ]( checkSet, pop, contextXML );
			}
		} else {
			checkSet = parts = [];
		}
	}

	if ( !checkSet ) {
		checkSet = set;
	}

	if ( !checkSet ) {
		throw "Syntax error, unrecognized expression: " + (cur || selector);
	}

	if ( toString.call(checkSet) === "[object Array]" ) {
		if ( !prune ) {
			results.push.apply( results, checkSet );
		} else if ( context && context.nodeType === 1 ) {
			for ( var i = 0; checkSet[i] != null; i++ ) {
				if ( checkSet[i] && (checkSet[i] === true || checkSet[i].nodeType === 1 && contains(context, checkSet[i])) ) {
					results.push( set[i] );
				}
			}
		} else {
			for ( var i = 0; checkSet[i] != null; i++ ) {
				if ( checkSet[i] && checkSet[i].nodeType === 1 ) {
					results.push( set[i] );
				}
			}
		}
	} else {
		makeArray( checkSet, results );
	}

	if ( extra ) {
		Sizzle( extra, origContext, results, seed );
		Sizzle.uniqueSort( results );
	}

	return results;
};

Sizzle.uniqueSort = function(results){
	if ( sortOrder ) {
		hasDuplicate = baseHasDuplicate;
		results.sort(sortOrder);

		if ( hasDuplicate ) {
			for ( var i = 1; i < results.length; i++ ) {
				if ( results[i] === results[i-1] ) {
					results.splice(i--, 1);
				}
			}
		}
	}

	return results;
};

Sizzle.matches = function(expr, set){
	return Sizzle(expr, null, null, set);
};

Sizzle.find = function(expr, context, isXML){
	var set, match;

	if ( !expr ) {
		return [];
	}

	for ( var i = 0, l = Expr.order.length; i < l; i++ ) {
		var type = Expr.order[i], match;

		if ( (match = Expr.leftMatch[ type ].exec( expr )) ) {
			var left = match[1];
			match.splice(1,1);

			if ( left.substr( left.length - 1 ) !== "\\" ) {
				match[1] = (match[1] || "").replace(/\\/g, "");
				set = Expr.find[ type ]( match, context, isXML );
				if ( set != null ) {
					expr = expr.replace( Expr.match[ type ], "" );
					break;
				}
			}
		}
	}

	if ( !set ) {
		set = context.getElementsByTagName("*");
	}

	return {set: set, expr: expr};
};

Sizzle.filter = function(expr, set, inplace, not){
	var old = expr, result = [], curLoop = set, match, anyFound,
		isXMLFilter = set && set[0] && isXML(set[0]);

	while ( expr && set.length ) {
		for ( var type in Expr.filter ) {
			if ( (match = Expr.match[ type ].exec( expr )) != null ) {
				var filter = Expr.filter[ type ], found, item;
				anyFound = false;

				if ( curLoop == result ) {
					result = [];
				}

				if ( Expr.preFilter[ type ] ) {
					match = Expr.preFilter[ type ]( match, curLoop, inplace, result, not, isXMLFilter );

					if ( !match ) {
						anyFound = found = true;
					} else if ( match === true ) {
						continue;
					}
				}

				if ( match ) {
					for ( var i = 0; (item = curLoop[i]) != null; i++ ) {
						if ( item ) {
							found = filter( item, match, i, curLoop );
							var pass = not ^ !!found;

							if ( inplace && found != null ) {
								if ( pass ) {
									anyFound = true;
								} else {
									curLoop[i] = false;
								}
							} else if ( pass ) {
								result.push( item );
								anyFound = true;
							}
						}
					}
				}

				if ( found !== undefined ) {
					if ( !inplace ) {
						curLoop = result;
					}

					expr = expr.replace( Expr.match[ type ], "" );

					if ( !anyFound ) {
						return [];
					}

					break;
				}
			}
		}

		if ( expr == old ) {
			if ( anyFound == null ) {
				throw "Syntax error, unrecognized expression: " + expr;
			} else {
				break;
			}
		}

		old = expr;
	}

	return curLoop;
};

var Expr = Sizzle.selectors = {
	order: [ "ID", "NAME", "TAG" ],
	match: {
		ID: /#((?:[\w\u00c0-\uFFFF-]|\\.)+)/,
		CLASS: /\.((?:[\w\u00c0-\uFFFF-]|\\.)+)/,
		NAME: /\[name=['"]*((?:[\w\u00c0-\uFFFF-]|\\.)+)['"]*\]/,
		ATTR: /\[\s*((?:[\w\u00c0-\uFFFF-]|\\.)+)\s*(?:(\S?=)\s*(['"]*)(.*?)\3|)\s*\]/,
		TAG: /^((?:[\w\u00c0-\uFFFF\*-]|\\.)+)/,
		CHILD: /:(only|nth|last|first)-child(?:\((even|odd|[\dn+-]*)\))?/,
		POS: /:(nth|eq|gt|lt|first|last|even|odd)(?:\((\d*)\))?(?=[^-]|$)/,
		PSEUDO: /:((?:[\w\u00c0-\uFFFF-]|\\.)+)(?:\((['"]*)((?:\([^\)]+\)|[^\2\(\)]*)+)\2\))?/
	},
	leftMatch: {},
	attrMap: {
		"class": "className",
		"for": "htmlFor"
	},
	attrHandle: {
		href: function(elem){
			return elem.getAttribute("href");
		}
	},
	relative: {
		"+": function(checkSet, part, isXML){
			var isPartStr = typeof part === "string",
				isTag = isPartStr && !/\W/.test(part),
				isPartStrNotTag = isPartStr && !isTag;

			if ( isTag && !isXML ) {
				part = part.toUpperCase();
			}

			for ( var i = 0, l = checkSet.length, elem; i < l; i++ ) {
				if ( (elem = checkSet[i]) ) {
					while ( (elem = elem.previousSibling) && elem.nodeType !== 1 ) {}

					checkSet[i] = isPartStrNotTag || elem && elem.nodeName === part ?
						elem || false :
						elem === part;
				}
			}

			if ( isPartStrNotTag ) {
				Sizzle.filter( part, checkSet, true );
			}
		},
		">": function(checkSet, part, isXML){
			var isPartStr = typeof part === "string";

			if ( isPartStr && !/\W/.test(part) ) {
				part = isXML ? part : part.toUpperCase();

				for ( var i = 0, l = checkSet.length; i < l; i++ ) {
					var elem = checkSet[i];
					if ( elem ) {
						var parent = elem.parentNode;
						checkSet[i] = parent.nodeName === part ? parent : false;
					}
				}
			} else {
				for ( var i = 0, l = checkSet.length; i < l; i++ ) {
					var elem = checkSet[i];
					if ( elem ) {
						checkSet[i] = isPartStr ?
							elem.parentNode :
							elem.parentNode === part;
					}
				}

				if ( isPartStr ) {
					Sizzle.filter( part, checkSet, true );
				}
			}
		},
		"": function(checkSet, part, isXML){
			var doneName = done++, checkFn = dirCheck;

			if ( !/\W/.test(part) ) {
				var nodeCheck = part = isXML ? part : part.toUpperCase();
				checkFn = dirNodeCheck;
			}

			checkFn("parentNode", part, doneName, checkSet, nodeCheck, isXML);
		},
		"~": function(checkSet, part, isXML){
			var doneName = done++, checkFn = dirCheck;

			if ( typeof part === "string" && !/\W/.test(part) ) {
				var nodeCheck = part = isXML ? part : part.toUpperCase();
				checkFn = dirNodeCheck;
			}

			checkFn("previousSibling", part, doneName, checkSet, nodeCheck, isXML);
		}
	},
	find: {
		ID: function(match, context, isXML){
			if ( typeof context.getElementById !== "undefined" && !isXML ) {
				var m = context.getElementById(match[1]);
				return m ? [m] : [];
			}
		},
		NAME: function(match, context, isXML){
			if ( typeof context.getElementsByName !== "undefined" ) {
				var ret = [], results = context.getElementsByName(match[1]);

				for ( var i = 0, l = results.length; i < l; i++ ) {
					if ( results[i].getAttribute("name") === match[1] ) {
						ret.push( results[i] );
					}
				}

				return ret.length === 0 ? null : ret;
			}
		},
		TAG: function(match, context){
			return context.getElementsByTagName(match[1]);
		}
	},
	preFilter: {
		CLASS: function(match, curLoop, inplace, result, not, isXML){
			match = " " + match[1].replace(/\\/g, "") + " ";

			if ( isXML ) {
				return match;
			}

			for ( var i = 0, elem; (elem = curLoop[i]) != null; i++ ) {
				if ( elem ) {
					if ( not ^ (elem.className && (" " + elem.className + " ").indexOf(match) >= 0) ) {
						if ( !inplace )
							result.push( elem );
					} else if ( inplace ) {
						curLoop[i] = false;
					}
				}
			}

			return false;
		},
		ID: function(match){
			return match[1].replace(/\\/g, "");
		},
		TAG: function(match, curLoop){
			for ( var i = 0; curLoop[i] === false; i++ ){}
			return curLoop[i] && isXML(curLoop[i]) ? match[1] : match[1].toUpperCase();
		},
		CHILD: function(match){
			if ( match[1] == "nth" ) {
				var test = /(-?)(\d*)n((?:\+|-)?\d*)/.exec(
					match[2] == "even" && "2n" || match[2] == "odd" && "2n+1" ||
					!/\D/.test( match[2] ) && "0n+" + match[2] || match[2]);

				match[2] = (test[1] + (test[2] || 1)) - 0;
				match[3] = test[3] - 0;
			}

			match[0] = done++;

			return match;
		},
		ATTR: function(match, curLoop, inplace, result, not, isXML){
			var name = match[1].replace(/\\/g, "");

			if ( !isXML && Expr.attrMap[name] ) {
				match[1] = Expr.attrMap[name];
			}

			if ( match[2] === "~=" ) {
				match[4] = " " + match[4] + " ";
			}

			return match;
		},
		PSEUDO: function(match, curLoop, inplace, result, not){
			if ( match[1] === "not" ) {
				if ( ( chunker.exec(match[3]) || "" ).length > 1 || /^\w/.test(match[3]) ) {
					match[3] = Sizzle(match[3], null, null, curLoop);
				} else {
					var ret = Sizzle.filter(match[3], curLoop, inplace, true ^ not);
					if ( !inplace ) {
						result.push.apply( result, ret );
					}
					return false;
				}
			} else if ( Expr.match.POS.test( match[0] ) || Expr.match.CHILD.test( match[0] ) ) {
				return true;
			}

			return match;
		},
		POS: function(match){
			match.unshift( true );
			return match;
		}
	},
	filters: {
		enabled: function(elem){
			return elem.disabled === false && elem.type !== "hidden";
		},
		disabled: function(elem){
			return elem.disabled === true;
		},
		checked: function(elem){
			return elem.checked === true;
		},
		selected: function(elem){
			elem.parentNode.selectedIndex;
			return elem.selected === true;
		},
		parent: function(elem){
			return !!elem.firstChild;
		},
		empty: function(elem){
			return !elem.firstChild;
		},
		has: function(elem, i, match){
			return !!Sizzle( match[3], elem ).length;
		},
		header: function(elem){
			return /h\d/i.test( elem.nodeName );
		},
		text: function(elem){
			return "text" === elem.type;
		},
		radio: function(elem){
			return "radio" === elem.type;
		},
		checkbox: function(elem){
			return "checkbox" === elem.type;
		},
		file: function(elem){
			return "file" === elem.type;
		},
		password: function(elem){
			return "password" === elem.type;
		},
		submit: function(elem){
			return "submit" === elem.type;
		},
		image: function(elem){
			return "image" === elem.type;
		},
		reset: function(elem){
			return "reset" === elem.type;
		},
		button: function(elem){
			return "button" === elem.type || elem.nodeName.toUpperCase() === "BUTTON";
		},
		input: function(elem){
			return /input|select|textarea|button/i.test(elem.nodeName);
		}
	},
	setFilters: {
		first: function(elem, i){
			return i === 0;
		},
		last: function(elem, i, match, array){
			return i === array.length - 1;
		},
		even: function(elem, i){
			return i % 2 === 0;
		},
		odd: function(elem, i){
			return i % 2 === 1;
		},
		lt: function(elem, i, match){
			return i < match[3] - 0;
		},
		gt: function(elem, i, match){
			return i > match[3] - 0;
		},
		nth: function(elem, i, match){
			return match[3] - 0 == i;
		},
		eq: function(elem, i, match){
			return match[3] - 0 == i;
		}
	},
	filter: {
		PSEUDO: function(elem, match, i, array){
			var name = match[1], filter = Expr.filters[ name ];

			if ( filter ) {
				return filter( elem, i, match, array );
			} else if ( name === "contains" ) {
				return (elem.textContent || elem.innerText || "").indexOf(match[3]) >= 0;
			} else if ( name === "not" ) {
				var not = match[3];

				for ( var i = 0, l = not.length; i < l; i++ ) {
					if ( not[i] === elem ) {
						return false;
					}
				}

				return true;
			}
		},
		CHILD: function(elem, match){
			var type = match[1], node = elem;
			switch (type) {
				case 'only':
				case 'first':
					while ( (node = node.previousSibling) )  {
						if ( node.nodeType === 1 ) return false;
					}
					if ( type == 'first') return true;
					node = elem;
				case 'last':
					while ( (node = node.nextSibling) )  {
						if ( node.nodeType === 1 ) return false;
					}
					return true;
				case 'nth':
					var first = match[2], last = match[3];

					if ( first == 1 && last == 0 ) {
						return true;
					}

					var doneName = match[0],
						parent = elem.parentNode;

					if ( parent && (parent.sizcache !== doneName || !elem.nodeIndex) ) {
						var count = 0;
						for ( node = parent.firstChild; node; node = node.nextSibling ) {
							if ( node.nodeType === 1 ) {
								node.nodeIndex = ++count;
							}
						}
						parent.sizcache = doneName;
					}

					var diff = elem.nodeIndex - last;
					if ( first == 0 ) {
						return diff == 0;
					} else {
						return ( diff % first == 0 && diff / first >= 0 );
					}
			}
		},
		ID: function(elem, match){
			return elem.nodeType === 1 && elem.getAttribute("id") === match;
		},
		TAG: function(elem, match){
			return (match === "*" && elem.nodeType === 1) || elem.nodeName === match;
		},
		CLASS: function(elem, match){
			return (" " + (elem.className || elem.getAttribute("class")) + " ")
				.indexOf( match ) > -1;
		},
		ATTR: function(elem, match){
			var name = match[1],
				result = Expr.attrHandle[ name ] ?
					Expr.attrHandle[ name ]( elem ) :
					elem[ name ] != null ?
						elem[ name ] :
						elem.getAttribute( name ),
				value = result + "",
				type = match[2],
				check = match[4];

			return result == null ?
				type === "!=" :
				type === "=" ?
				value === check :
				type === "*=" ?
				value.indexOf(check) >= 0 :
				type === "~=" ?
				(" " + value + " ").indexOf(check) >= 0 :
				!check ?
				value && result !== false :
				type === "!=" ?
				value != check :
				type === "^=" ?
				value.indexOf(check) === 0 :
				type === "$=" ?
				value.substr(value.length - check.length) === check :
				type === "|=" ?
				value === check || value.substr(0, check.length + 1) === check + "-" :
				false;
		},
		POS: function(elem, match, i, array){
			var name = match[2], filter = Expr.setFilters[ name ];

			if ( filter ) {
				return filter( elem, i, match, array );
			}
		}
	}
};

var origPOS = Expr.match.POS;

for ( var type in Expr.match ) {
	Expr.match[ type ] = new RegExp( Expr.match[ type ].source + /(?![^\[]*\])(?![^\(]*\))/.source );
	Expr.leftMatch[ type ] = new RegExp( /(^(?:.|\r|\n)*?)/.source + Expr.match[ type ].source );
}

var makeArray = function(array, results) {
	array = Array.prototype.slice.call( array, 0 );

	if ( results ) {
		results.push.apply( results, array );
		return results;
	}

	return array;
};

try {
	Array.prototype.slice.call( document.documentElement.childNodes, 0 );

} catch(e){
	makeArray = function(array, results) {
		var ret = results || [];

		if ( toString.call(array) === "[object Array]" ) {
			Array.prototype.push.apply( ret, array );
		} else {
			if ( typeof array.length === "number" ) {
				for ( var i = 0, l = array.length; i < l; i++ ) {
					ret.push( array[i] );
				}
			} else {
				for ( var i = 0; array[i]; i++ ) {
					ret.push( array[i] );
				}
			}
		}

		return ret;
	};
}

var sortOrder;

if ( document.documentElement.compareDocumentPosition ) {
	sortOrder = function( a, b ) {
		if ( !a.compareDocumentPosition || !b.compareDocumentPosition ) {
			if ( a == b ) {
				hasDuplicate = true;
			}
			return 0;
		}

		var ret = a.compareDocumentPosition(b) & 4 ? -1 : a === b ? 0 : 1;
		if ( ret === 0 ) {
			hasDuplicate = true;
		}
		return ret;
	};
} else if ( "sourceIndex" in document.documentElement ) {
	sortOrder = function( a, b ) {
		if ( !a.sourceIndex || !b.sourceIndex ) {
			if ( a == b ) {
				hasDuplicate = true;
			}
			return 0;
		}

		var ret = a.sourceIndex - b.sourceIndex;
		if ( ret === 0 ) {
			hasDuplicate = true;
		}
		return ret;
	};
} else if ( document.createRange ) {
	sortOrder = function( a, b ) {
		if ( !a.ownerDocument || !b.ownerDocument ) {
			if ( a == b ) {
				hasDuplicate = true;
			}
			return 0;
		}

		var aRange = a.ownerDocument.createRange(), bRange = b.ownerDocument.createRange();
		aRange.setStart(a, 0);
		aRange.setEnd(a, 0);
		bRange.setStart(b, 0);
		bRange.setEnd(b, 0);
		var ret = aRange.compareBoundaryPoints(Range.START_TO_END, bRange);
		if ( ret === 0 ) {
			hasDuplicate = true;
		}
		return ret;
	};
}

(function(){
	var form = document.createElement("div"),
		id = "script" + (new Date).getTime();
	form.innerHTML = "<a name='" + id + "'/>";

	var root = document.documentElement;
	root.insertBefore( form, root.firstChild );

	if ( !!document.getElementById( id ) ) {
		Expr.find.ID = function(match, context, isXML){
			if ( typeof context.getElementById !== "undefined" && !isXML ) {
				var m = context.getElementById(match[1]);
				return m ? m.id === match[1] || typeof m.getAttributeNode !== "undefined" && m.getAttributeNode("id").nodeValue === match[1] ? [m] : undefined : [];
			}
		};

		Expr.filter.ID = function(elem, match){
			var node = typeof elem.getAttributeNode !== "undefined" && elem.getAttributeNode("id");
			return elem.nodeType === 1 && node && node.nodeValue === match;
		};
	}

	root.removeChild( form );
	root = form = null; // release memory in IE
})();

(function(){

	var div = document.createElement("div");
	div.appendChild( document.createComment("") );

	if ( div.getElementsByTagName("*").length > 0 ) {
		Expr.find.TAG = function(match, context){
			var results = context.getElementsByTagName(match[1]);

			if ( match[1] === "*" ) {
				var tmp = [];

				for ( var i = 0; results[i]; i++ ) {
					if ( results[i].nodeType === 1 ) {
						tmp.push( results[i] );
					}
				}

				results = tmp;
			}

			return results;
		};
	}

	div.innerHTML = "<a href='#'></a>";
	if ( div.firstChild && typeof div.firstChild.getAttribute !== "undefined" &&
			div.firstChild.getAttribute("href") !== "#" ) {
		Expr.attrHandle.href = function(elem){
			return elem.getAttribute("href", 2);
		};
	}

	div = null; // release memory in IE
})();

if ( document.querySelectorAll ) (function(){
	var oldSizzle = Sizzle, div = document.createElement("div");
	div.innerHTML = "<p class='TEST'></p>";

	if ( div.querySelectorAll && div.querySelectorAll(".TEST").length === 0 ) {
		return;
	}

	Sizzle = function(query, context, extra, seed){
		context = context || document;

		if ( !seed && context.nodeType === 9 && !isXML(context) ) {
			try {
				return makeArray( context.querySelectorAll(query), extra );
			} catch(e){}
		}

		return oldSizzle(query, context, extra, seed);
	};

	for ( var prop in oldSizzle ) {
		Sizzle[ prop ] = oldSizzle[ prop ];
	}

	div = null; // release memory in IE
})();

if ( document.getElementsByClassName && document.documentElement.getElementsByClassName ) (function(){
	var div = document.createElement("div");
	div.innerHTML = "<div class='test e'></div><div class='test'></div>";

	if ( div.getElementsByClassName("e").length === 0 )
		return;

	div.lastChild.className = "e";

	if ( div.getElementsByClassName("e").length === 1 )
		return;

	Expr.order.splice(1, 0, "CLASS");
	Expr.find.CLASS = function(match, context, isXML) {
		if ( typeof context.getElementsByClassName !== "undefined" && !isXML ) {
			return context.getElementsByClassName(match[1]);
		}
	};

	div = null; // release memory in IE
})();

function dirNodeCheck( dir, cur, doneName, checkSet, nodeCheck, isXML ) {
	var sibDir = dir == "previousSibling" && !isXML;
	for ( var i = 0, l = checkSet.length; i < l; i++ ) {
		var elem = checkSet[i];
		if ( elem ) {
			if ( sibDir && elem.nodeType === 1 ){
				elem.sizcache = doneName;
				elem.sizset = i;
			}
			elem = elem[dir];
			var match = false;

			while ( elem ) {
				if ( elem.sizcache === doneName ) {
					match = checkSet[elem.sizset];
					break;
				}

				if ( elem.nodeType === 1 && !isXML ){
					elem.sizcache = doneName;
					elem.sizset = i;
				}

				if ( elem.nodeName === cur ) {
					match = elem;
					break;
				}

				elem = elem[dir];
			}

			checkSet[i] = match;
		}
	}
}

function dirCheck( dir, cur, doneName, checkSet, nodeCheck, isXML ) {
	var sibDir = dir == "previousSibling" && !isXML;
	for ( var i = 0, l = checkSet.length; i < l; i++ ) {
		var elem = checkSet[i];
		if ( elem ) {
			if ( sibDir && elem.nodeType === 1 ) {
				elem.sizcache = doneName;
				elem.sizset = i;
			}
			elem = elem[dir];
			var match = false;

			while ( elem ) {
				if ( elem.sizcache === doneName ) {
					match = checkSet[elem.sizset];
					break;
				}

				if ( elem.nodeType === 1 ) {
					if ( !isXML ) {
						elem.sizcache = doneName;
						elem.sizset = i;
					}
					if ( typeof cur !== "string" ) {
						if ( elem === cur ) {
							match = true;
							break;
						}

					} else if ( Sizzle.filter( cur, [elem] ).length > 0 ) {
						match = elem;
						break;
					}
				}

				elem = elem[dir];
			}

			checkSet[i] = match;
		}
	}
}

var contains = document.compareDocumentPosition ?  function(a, b){
	return a.compareDocumentPosition(b) & 16;
} : function(a, b){
	return a !== b && (a.contains ? a.contains(b) : true);
};

var isXML = function(elem){
	return elem.nodeType === 9 && elem.documentElement.nodeName !== "HTML" ||
		!!elem.ownerDocument && elem.ownerDocument.documentElement.nodeName !== "HTML";
};

var posProcess = function(selector, context){
	var tmpSet = [], later = "", match,
		root = context.nodeType ? [context] : context;

	while ( (match = Expr.match.PSEUDO.exec( selector )) ) {
		later += match[0];
		selector = selector.replace( Expr.match.PSEUDO, "" );
	}

	selector = Expr.relative[selector] ? selector + "*" : selector;

	for ( var i = 0, l = root.length; i < l; i++ ) {
		Sizzle( selector, root[i], tmpSet );
	}

	return Sizzle.filter( later, tmpSet );
};


window.Sizzle = Sizzle;

})();

;(function(engine) {
  var extendElements = Prototype.Selector.extendElements;

  function select(selector, scope) {
    return extendElements(engine(selector, scope || document));
  }

  function match(element, selector) {
    return engine.matches(selector, [element]).length == 1;
  }

  Prototype.Selector.engine = engine;
  Prototype.Selector.select = select;
  Prototype.Selector.match = match;
})(Sizzle);

window.Sizzle = Prototype._original_property;
delete Prototype._original_property;

var Form = {
  reset: function(form) {
    form = $(form);
    form.reset();
    return form;
  },

  serializeElements: function(elements, options) {
    if (typeof options != 'object') options = { hash: !!options };
    else if (Object.isUndefined(options.hash)) options.hash = true;
    var key, value, submitted = false, submit = options.submit, accumulator, initial;

    if (options.hash) {
      initial = {};
      accumulator = function(result, key, value) {
        if (key in result) {
          if (!Object.isArray(result[key])) result[key] = [result[key]];
          result[key].push(value);
        } else result[key] = value;
        return result;
      };
    } else {
      initial = '';
      accumulator = function(result, key, value) {
        return result + (result ? '&' : '') + encodeURIComponent(key) + '=' + encodeURIComponent(value);
      }
    }

    return elements.inject(initial, function(result, element) {
      if (!element.disabled && element.name) {
        key = element.name; value = $(element).getValue();
        if (value != null && element.type != 'file' && (element.type != 'submit' || (!submitted &&
            submit !== false && (!submit || key == submit) && (submitted = true)))) {
          result = accumulator(result, key, value);
        }
      }
      return result;
    });
  }
};

Form.Methods = {
  serialize: function(form, options) {
    return Form.serializeElements(Form.getElements(form), options);
  },

  getElements: function(form) {
    var elements = $(form).getElementsByTagName('*'),
        element,
        arr = [ ],
        serializers = Form.Element.Serializers;
    for (var i = 0; element = elements[i]; i++) {
      arr.push(element);
    }
    return arr.inject([], function(elements, child) {
      if (serializers[child.tagName.toLowerCase()])
        elements.push(Element.extend(child));
      return elements;
    })
  },

  getInputs: function(form, typeName, name) {
    form = $(form);
    var inputs = form.getElementsByTagName('input');

    if (!typeName && !name) return $A(inputs).map(Element.extend);

    for (var i = 0, matchingInputs = [], length = inputs.length; i < length; i++) {
      var input = inputs[i];
      if ((typeName && input.type != typeName) || (name && input.name != name))
        continue;
      matchingInputs.push(Element.extend(input));
    }

    return matchingInputs;
  },

  disable: function(form) {
    form = $(form);
    Form.getElements(form).invoke('disable');
    return form;
  },

  enable: function(form) {
    form = $(form);
    Form.getElements(form).invoke('enable');
    return form;
  },

  findFirstElement: function(form) {
    var elements = $(form).getElements().findAll(function(element) {
      return 'hidden' != element.type && !element.disabled;
    });
    var firstByIndex = elements.findAll(function(element) {
      return element.hasAttribute('tabIndex') && element.tabIndex >= 0;
    }).sortBy(function(element) { return element.tabIndex }).first();

    return firstByIndex ? firstByIndex : elements.find(function(element) {
      return /^(?:input|select|textarea)$/i.test(element.tagName);
    });
  },

  focusFirstElement: function(form) {
    form = $(form);
    var element = form.findFirstElement();
    if (element) element.activate();
    return form;
  },

  request: function(form, options) {
    form = $(form), options = Object.clone(options || { });

    var params = options.parameters, action = form.readAttribute('action') || '';
    if (action.blank()) action = window.location.href;
    options.parameters = form.serialize(true);

    if (params) {
      if (Object.isString(params)) params = params.toQueryParams();
      Object.extend(options.parameters, params);
    }

    if (form.hasAttribute('method') && !options.method)
      options.method = form.getAttribute('method');

    return new Ajax.Request(action, options);
  }
};

/*--------------------------------------------------------------------------*/


Form.Element = {
  focus: function(element) {
    $(element).focus();
    return element;
  },

  select: function(element) {
    $(element).select();
    return element;
  }
};

Form.Element.Methods = {

  serialize: function(element) {
    element = $(element);
    if (!element.disabled && element.name) {
      var value = element.getValue();
      if (value != undefined) {
        var pair = { };
        pair[element.name] = value;
        return Object.toQueryString(pair);
      }
    }
    return '';
  },

  getValue: function(element) {
    element = $(element);
    var method = element.tagName.toLowerCase();
    return Form.Element.Serializers[method](element);
  },

  setValue: function(element, value) {
    element = $(element);
    var method = element.tagName.toLowerCase();
    Form.Element.Serializers[method](element, value);
    return element;
  },

  clear: function(element) {
    $(element).value = '';
    return element;
  },

  present: function(element) {
    return $(element).value != '';
  },

  activate: function(element) {
    element = $(element);
    try {
      element.focus();
      if (element.select && (element.tagName.toLowerCase() != 'input' ||
          !(/^(?:button|reset|submit)$/i.test(element.type))))
        element.select();
    } catch (e) { }
    return element;
  },

  disable: function(element) {
    element = $(element);
    element.disabled = true;
    return element;
  },

  enable: function(element) {
    element = $(element);
    element.disabled = false;
    return element;
  }
};

/*--------------------------------------------------------------------------*/

var Field = Form.Element;

var $F = Form.Element.Methods.getValue;

/*--------------------------------------------------------------------------*/

Form.Element.Serializers = (function() {
  function input(element, value) {
    switch (element.type.toLowerCase()) {
      case 'checkbox':
      case 'radio':
        return inputSelector(element, value);
      default:
        return valueSelector(element, value);
    }
  }

  function inputSelector(element, value) {
    if (Object.isUndefined(value))
      return element.checked ? element.value : null;
    else element.checked = !!value;
  }

  function valueSelector(element, value) {
    if (Object.isUndefined(value)) return element.value;
    else element.value = value;
  }

  function select(element, value) {
    if (Object.isUndefined(value))
      return (element.type === 'select-one' ? selectOne : selectMany)(element);

    var opt, currentValue, single = !Object.isArray(value);
    for (var i = 0, length = element.length; i < length; i++) {
      opt = element.options[i];
      currentValue = this.optionValue(opt);
      if (single) {
        if (currentValue == value) {
          opt.selected = true;
          return;
        }
      }
      else opt.selected = value.include(currentValue);
    }
  }

  function selectOne(element) {
    var index = element.selectedIndex;
    return index >= 0 ? optionValue(element.options[index]) : null;
  }

  function selectMany(element) {
    var values, length = element.length;
    if (!length) return null;

    for (var i = 0, values = []; i < length; i++) {
      var opt = element.options[i];
      if (opt.selected) values.push(optionValue(opt));
    }
    return values;
  }

  function optionValue(opt) {
    return Element.hasAttribute(opt, 'value') ? opt.value : opt.text;
  }

  return {
    input:         input,
    inputSelector: inputSelector,
    textarea:      valueSelector,
    select:        select,
    selectOne:     selectOne,
    selectMany:    selectMany,
    optionValue:   optionValue,
    button:        valueSelector
  };
})();

/*--------------------------------------------------------------------------*/


Abstract.TimedObserver = Class.create(PeriodicalExecuter, {
  initialize: function($super, element, frequency, callback) {
    $super(callback, frequency);
    this.element   = $(element);
    this.lastValue = this.getValue();
  },

  execute: function() {
    var value = this.getValue();
    if (Object.isString(this.lastValue) && Object.isString(value) ?
        this.lastValue != value : String(this.lastValue) != String(value)) {
      this.callback(this.element, value);
      this.lastValue = value;
    }
  }
});

Form.Element.Observer = Class.create(Abstract.TimedObserver, {
  getValue: function() {
    return Form.Element.getValue(this.element);
  }
});

Form.Observer = Class.create(Abstract.TimedObserver, {
  getValue: function() {
    return Form.serialize(this.element);
  }
});

/*--------------------------------------------------------------------------*/

Abstract.EventObserver = Class.create({
  initialize: function(element, callback) {
    this.element  = $(element);
    this.callback = callback;

    this.lastValue = this.getValue();
    if (this.element.tagName.toLowerCase() == 'form')
      this.registerFormCallbacks();
    else
      this.registerCallback(this.element);
  },

  onElementEvent: function() {
    var value = this.getValue();
    if (this.lastValue != value) {
      this.callback(this.element, value);
      this.lastValue = value;
    }
  },

  registerFormCallbacks: function() {
    Form.getElements(this.element).each(this.registerCallback, this);
  },

  registerCallback: function(element) {
    if (element.type) {
      switch (element.type.toLowerCase()) {
        case 'checkbox':
        case 'radio':
          Event.observe(element, 'click', this.onElementEvent.bind(this));
          break;
        default:
          Event.observe(element, 'change', this.onElementEvent.bind(this));
          break;
      }
    }
  }
});

Form.Element.EventObserver = Class.create(Abstract.EventObserver, {
  getValue: function() {
    return Form.Element.getValue(this.element);
  }
});

Form.EventObserver = Class.create(Abstract.EventObserver, {
  getValue: function() {
    return Form.serialize(this.element);
  }
});
(function() {

  var Event = {
    KEY_BACKSPACE: 8,
    KEY_TAB:       9,
    KEY_RETURN:   13,
    KEY_ESC:      27,
    KEY_SPACE:    32,
    KEY_LEFT:     37,
    KEY_UP:       38,
    KEY_RIGHT:    39,
    KEY_DOWN:     40,
    KEY_DELETE:   46,
    KEY_HOME:     36,
    KEY_END:      35,
    KEY_PAGEUP:   33,
    KEY_PAGEDOWN: 34,
    KEY_INSERT:   45,

    cache: {}
  };

  var docEl = document.documentElement;
  var MOUSEENTER_MOUSELEAVE_EVENTS_SUPPORTED = 'onmouseenter' in docEl
    && 'onmouseleave' in docEl;



  var isIELegacyEvent = function(event) { return false; };

  if (window.attachEvent) {
    if (window.addEventListener) {
      isIELegacyEvent = function(event) {
        return !(event instanceof window.Event);
      };
    } else {
      isIELegacyEvent = function(event) { return true; };
    }
  }

  var _isButton;

  function _isButtonForDOMEvents(event, code) {
    return event.which ? (event.which === code + 1) : (event.button === code);
  }

  var legacyButtonMap = { 0: 1, 1: 4, 2: 2 };
  function _isButtonForLegacyEvents(event, code) {
    return event.button === legacyButtonMap[code];
  }

  function _isButtonForWebKit(event, code) {
    switch (code) {
      case 0: return event.which == 1 && !event.metaKey;
      case 1: return event.which == 2 || (event.which == 1 && event.metaKey);
      case 2: return event.which == 3;
      default: return false;
    }
  }

  if (window.attachEvent) {
    if (!window.addEventListener) {
      _isButton = _isButtonForLegacyEvents;
    } else {
      _isButton = function(event, code) {
        return isIELegacyEvent(event) ? _isButtonForLegacyEvents(event, code) :
         _isButtonForDOMEvents(event, code);
      }
    }
  } else if (Prototype.Browser.WebKit) {
    _isButton = _isButtonForWebKit;
  } else {
    _isButton = _isButtonForDOMEvents;
  }

  function isLeftClick(event)   { return _isButton(event, 0) }

  function isMiddleClick(event) { return _isButton(event, 1) }

  function isRightClick(event)  { return _isButton(event, 2) }

  function element(event) {
    event = Event.extend(event);

    var node = event.target, type = event.type,
     currentTarget = event.currentTarget;

    if (currentTarget && currentTarget.tagName) {
      if (type === 'load' || type === 'error' ||
        (type === 'click' && currentTarget.tagName.toLowerCase() === 'input'
          && currentTarget.type === 'radio'))
            node = currentTarget;
    }

    if (node.nodeType == Node.TEXT_NODE)
      node = node.parentNode;

    return Element.extend(node);
  }

  function findElement(event, expression) {
    var element = Event.element(event);

    if (!expression) return element;
    while (element) {
      if (Object.isElement(element) && Prototype.Selector.match(element, expression)) {
        return Element.extend(element);
      }
      element = element.parentNode;
    }
  }

  function pointer(event) {
    return { x: pointerX(event), y: pointerY(event) };
  }

  function pointerX(event) {
    var docElement = document.documentElement,
     body = document.body || { scrollLeft: 0 };

    return event.pageX || (event.clientX +
      (docElement.scrollLeft || body.scrollLeft) -
      (docElement.clientLeft || 0));
  }

  function pointerY(event) {
    var docElement = document.documentElement,
     body = document.body || { scrollTop: 0 };

    return  event.pageY || (event.clientY +
       (docElement.scrollTop || body.scrollTop) -
       (docElement.clientTop || 0));
  }


  function stop(event) {
    Event.extend(event);
    event.preventDefault();
    event.stopPropagation();

    event.stopped = true;
  }


  Event.Methods = {
    isLeftClick:   isLeftClick,
    isMiddleClick: isMiddleClick,
    isRightClick:  isRightClick,

    element:     element,
    findElement: findElement,

    pointer:  pointer,
    pointerX: pointerX,
    pointerY: pointerY,

    stop: stop
  };

  var methods = Object.keys(Event.Methods).inject({ }, function(m, name) {
    m[name] = Event.Methods[name].methodize();
    return m;
  });

  if (window.attachEvent) {
    function _relatedTarget(event) {
      var element;
      switch (event.type) {
        case 'mouseover':
        case 'mouseenter':
          element = event.fromElement;
          break;
        case 'mouseout':
        case 'mouseleave':
          element = event.toElement;
          break;
        default:
          return null;
      }
      return Element.extend(element);
    }

    var additionalMethods = {
      stopPropagation: function() { this.cancelBubble = true },
      preventDefault:  function() { this.returnValue = false },
      inspect: function() { return '[object Event]' }
    };

    Event.extend = function(event, element) {
      if (!event) return false;

      if (!isIELegacyEvent(event)) return event;

      if (event._extendedByPrototype) return event;
      event._extendedByPrototype = Prototype.emptyFunction;

      var pointer = Event.pointer(event);

      Object.extend(event, {
        target: event.srcElement || element,
        relatedTarget: _relatedTarget(event),
        pageX:  pointer.x,
        pageY:  pointer.y
      });

      Object.extend(event, methods);
      Object.extend(event, additionalMethods);

      return event;
    };
  } else {
    Event.extend = Prototype.K;
  }

  if (window.addEventListener) {
    Event.prototype = window.Event.prototype || document.createEvent('HTMLEvents').__proto__;
    Object.extend(Event.prototype, methods);
  }

  function _createResponder(element, eventName, handler) {
    var registry = Element.retrieve(element, 'prototype_event_registry');

    if (Object.isUndefined(registry)) {
      CACHE.push(element);
      registry = Element.retrieve(element, 'prototype_event_registry', $H());
    }

    var respondersForEvent = registry.get(eventName);
    if (Object.isUndefined(respondersForEvent)) {
      respondersForEvent = [];
      registry.set(eventName, respondersForEvent);
    }

    if (respondersForEvent.pluck('handler').include(handler)) return false;

    var responder;
    if (eventName.include(":")) {
      responder = function(event) {
        if (Object.isUndefined(event.eventName))
          return false;

        if (event.eventName !== eventName)
          return false;

        Event.extend(event, element);
        handler.call(element, event);
      };
    } else {
      if (!MOUSEENTER_MOUSELEAVE_EVENTS_SUPPORTED &&
       (eventName === "mouseenter" || eventName === "mouseleave")) {
        if (eventName === "mouseenter" || eventName === "mouseleave") {
          responder = function(event) {
            Event.extend(event, element);

            var parent = event.relatedTarget;
            while (parent && parent !== element) {
              try { parent = parent.parentNode; }
              catch(e) { parent = element; }
            }

            if (parent === element) return;

            handler.call(element, event);
          };
        }
      } else {
        if (eventName === "beforeunload")
        {
          responder = function(event) {
            Event.extend(event, element);
            return handler.call(element, event);
          };
        }
        else
        {
          responder = function(event) {
            Event.extend(event, element);
            handler.call(element, event);
          };
        }
      }
    }

    responder.handler = handler;
    respondersForEvent.push(responder);
    return responder;
  }

  function _destroyCache() {
    for (var i = 0, length = CACHE.length; i < length; i++) {
      Event.stopObserving(CACHE[i]);
      CACHE[i] = null;
    }
  }

  var CACHE = [];

  if (Prototype.Browser.IE)
    window.attachEvent('onunload', _destroyCache);

  if (Prototype.Browser.WebKit)
    window.addEventListener('unload', Prototype.emptyFunction, false);


  var _getDOMEventName = Prototype.K,
      translations = { mouseenter: "mouseover", mouseleave: "mouseout" };

  if (!MOUSEENTER_MOUSELEAVE_EVENTS_SUPPORTED) {
    _getDOMEventName = function(eventName) {
      return (translations[eventName] || eventName);
    };
  }

  function observe(element, eventName, handler) {
    element = $(element);

    var responder = _createResponder(element, eventName, handler);

    if (!responder) return element;

    if (eventName.include(':')) {
      if (element.addEventListener)
        element.addEventListener("dataavailable", responder, false);
      else {
        element.attachEvent("ondataavailable", responder);
        element.attachEvent("onlosecapture", responder);
      }
    } else {
      var actualEventName = _getDOMEventName(eventName);

      if (element.addEventListener)
        element.addEventListener(actualEventName, responder, false);
      else
        element.attachEvent("on" + actualEventName, responder);
    }

    return element;
  }

  function stopObserving(element, eventName, handler) {
    element = $(element);

    var registry = Element.retrieve(element, 'prototype_event_registry');
    if (!registry) return element;

    if (!eventName) {
      registry.each( function(pair) {
        var eventName = pair.key;
        stopObserving(element, eventName);
      });
      return element;
    }

    var responders = registry.get(eventName);
    if (!responders) return element;

    if (!handler) {
      responders.each(function(r) {
        stopObserving(element, eventName, r.handler);
      });
      return element;
    }

    var i = responders.length, responder;
    while (i--) {
      if (responders[i].handler === handler) {
        responder = responders[i];
        break;
      }
    }
    if (!responder) return element;

    if (eventName.include(':')) {
      if (element.removeEventListener)
        element.removeEventListener("dataavailable", responder, false);
      else {
        element.detachEvent("ondataavailable", responder);
        element.detachEvent("onlosecapture", responder);
      }
    } else {
      var actualEventName = _getDOMEventName(eventName);
      if (element.removeEventListener)
        element.removeEventListener(actualEventName, responder, false);
      else
        element.detachEvent('on' + actualEventName, responder);
    }

    registry.set(eventName, responders.without(responder));

    return element;
  }

  function fire(element, eventName, memo, bubble) {
    element = $(element);

    if (Object.isUndefined(bubble))
      bubble = true;

    if (element == document && document.createEvent && !element.dispatchEvent)
      element = document.documentElement;

    var event;
    if (document.createEvent) {
      event = document.createEvent('HTMLEvents');
      event.initEvent('dataavailable', bubble, true);
    } else {
      event = document.createEventObject();
      event.eventType = bubble ? 'ondataavailable' : 'onlosecapture';
    }

    event.eventName = eventName;
    event.memo = memo || { };

    if (document.createEvent)
      element.dispatchEvent(event);
    else
      element.fireEvent(event.eventType, event);

    return Event.extend(event);
  }

  Event.Handler = Class.create({
    initialize: function(element, eventName, selector, callback) {
      this.element   = $(element);
      this.eventName = eventName;
      this.selector  = selector;
      this.callback  = callback;
      this.handler   = this.handleEvent.bind(this);
    },

    start: function() {
      Event.observe(this.element, this.eventName, this.handler);
      return this;
    },

    stop: function() {
      Event.stopObserving(this.element, this.eventName, this.handler);
      return this;
    },

    handleEvent: function(event) {
      var element = Event.findElement(event, this.selector);
      if (element) this.callback.call(this.element, event, element);
    }
  });

  function on(element, eventName, selector, callback) {
    element = $(element);
    if (Object.isFunction(selector) && Object.isUndefined(callback)) {
      callback = selector, selector = null;
    }

    return new Event.Handler(element, eventName, selector, callback).start();
  }

  Object.extend(Event, Event.Methods);

  Object.extend(Event, {
    fire:          fire,
    observe:       observe,
    stopObserving: stopObserving,
    on:            on
  });

  Element.addMethods({
    fire:          fire,

    observe:       observe,

    stopObserving: stopObserving,

    on:            on
  });

  Object.extend(document, {
    fire:          fire.methodize(),

    observe:       observe.methodize(),

    stopObserving: stopObserving.methodize(),

    on:            on.methodize(),

    loaded:        false
  });

  if (window.Event) Object.extend(window.Event, Event);
  else window.Event = Event;
})();

(function() {
  /* Support for the DOMContentLoaded event is based on work by Dan Webb,
     Matthias Miller, Dean Edwards, John Resig, and Diego Perini. */

  var timer;

  function fireContentLoadedEvent() {
    if (document.loaded) return;
    if (timer) window.clearTimeout(timer);
    document.loaded = true;
    document.fire('dom:loaded');
  }

  function checkReadyState() {
    if (document.readyState === 'complete') {
      document.stopObserving('readystatechange', checkReadyState);
      fireContentLoadedEvent();
    }
  }

  function pollDoScroll() {
    try { document.documentElement.doScroll('left'); }
    catch(e) {
      timer = pollDoScroll.defer();
      return;
    }
    fireContentLoadedEvent();
  }

  if (document.addEventListener) {
    document.addEventListener('DOMContentLoaded', fireContentLoadedEvent, false);
  } else {
    document.observe('readystatechange', checkReadyState);
    if (window == top)
      timer = pollDoScroll.defer();
  }

  Event.observe(window, 'load', fireContentLoadedEvent);
})();

Element.addMethods();

/*------------------------------- DEPRECATED -------------------------------*/

Hash.toQueryString = Object.toQueryString;

var Toggle = { display: Element.toggle };

Element.Methods.childOf = Element.Methods.descendantOf;

var Insertion = {
  Before: function(element, content) {
    return Element.insert(element, {before:content});
  },

  Top: function(element, content) {
    return Element.insert(element, {top:content});
  },

  Bottom: function(element, content) {
    return Element.insert(element, {bottom:content});
  },

  After: function(element, content) {
    return Element.insert(element, {after:content});
  }
};

var $continue = new Error('"throw $continue" is deprecated, use "return" instead');

var Position = {
  includeScrollOffsets: false,

  prepare: function() {
    this.deltaX =  window.pageXOffset
                || document.documentElement.scrollLeft
                || document.body.scrollLeft
                || 0;
    this.deltaY =  window.pageYOffset
                || document.documentElement.scrollTop
                || document.body.scrollTop
                || 0;
  },

  within: function(element, x, y) {
    if (this.includeScrollOffsets)
      return this.withinIncludingScrolloffsets(element, x, y);
    this.xcomp = x;
    this.ycomp = y;
    this.offset = Element.cumulativeOffset(element);

    return (y >= this.offset[1] &&
            y <  this.offset[1] + element.offsetHeight &&
            x >= this.offset[0] &&
            x <  this.offset[0] + element.offsetWidth);
  },

  withinIncludingScrolloffsets: function(element, x, y) {
    var offsetcache = Element.cumulativeScrollOffset(element);

    this.xcomp = x + offsetcache[0] - this.deltaX;
    this.ycomp = y + offsetcache[1] - this.deltaY;
    this.offset = Element.cumulativeOffset(element);

    return (this.ycomp >= this.offset[1] &&
            this.ycomp <  this.offset[1] + element.offsetHeight &&
            this.xcomp >= this.offset[0] &&
            this.xcomp <  this.offset[0] + element.offsetWidth);
  },

  overlap: function(mode, element) {
    if (!mode) return 0;
    if (mode == 'vertical')
      return ((this.offset[1] + element.offsetHeight) - this.ycomp) /
        element.offsetHeight;
    if (mode == 'horizontal')
      return ((this.offset[0] + element.offsetWidth) - this.xcomp) /
        element.offsetWidth;
  },


  cumulativeOffset: Element.Methods.cumulativeOffset,

  positionedOffset: Element.Methods.positionedOffset,

  absolutize: function(element) {
    Position.prepare();
    return Element.absolutize(element);
  },

  relativize: function(element) {
    Position.prepare();
    return Element.relativize(element);
  },

  realOffset: Element.Methods.cumulativeScrollOffset,

  offsetParent: Element.Methods.getOffsetParent,

  page: Element.Methods.viewportOffset,

  clone: function(source, target, options) {
    options = options || { };
    return Element.clonePosition(target, source, options);
  }
};

/*--------------------------------------------------------------------------*/

if (!document.getElementsByClassName) document.getElementsByClassName = function(instanceMethods){
  function iter(name) {
    return name.blank() ? null : "[contains(concat(' ', @class, ' '), ' " + name + " ')]";
  }

  var _getElementsByClassName = instanceMethods.getElementsByClassName = Prototype.BrowserFeatures.XPath ?
  function(element, className) {
    className = className.toString().strip();
    var cond = /\s/.test(className) ? $w(className).map(iter).join('') : iter(className);
    return cond ? document._getElementsByXPath('.//*' + cond, element) : [];
  } : function(element, className) {
    className = className.toString().strip();
    var elements = [], classNames = (/\s/.test(className) ? $w(className) : null);
    if (!classNames && !className) return elements;

    var nodes = $(element).getElementsByTagName('*');
    className = ' ' + className + ' ';

    for (var i = 0, child, cn; child = nodes[i]; i++) {
      if (child.className && (cn = ' ' + child.className + ' ') && (cn.include(className) ||
          (classNames && classNames.all(function(name) {
            return !name.toString().blank() && cn.include(' ' + name + ' ');
          }))))
        elements.push(Element.extend(child));
    }
    return elements;
  };

  return function(className, parentElement) {
    return _getElementsByClassName( parentElement || document.body, className );
  };
}(Element.Methods);

/*--------------------------------------------------------------------------*/

Element.ClassNames = Class.create();
Element.ClassNames.prototype = {
  initialize: function(element) {
    this.element = $(element);
  },

  _each: function(iterator) {
    this.element.className.split(/\s+/).select(function(name) {
      return name.length > 0;
    })._each(iterator);
  },

  set: function(className) {
    this.element.className = className;
  },

  add: function(classNameToAdd) {
    if (this.include(classNameToAdd)) return;
    this.set($A(this).concat(classNameToAdd).join(' '));
  },

  remove: function(classNameToRemove) {
    if (!this.include(classNameToRemove)) return;
    this.set($A(this).without(classNameToRemove).join(' '));
  },

  toString: function() {
    return $A(this).join(' ');
  }
};

Object.extend(Element.ClassNames.prototype, Enumerable);

/*--------------------------------------------------------------------------*/

(function() {
  window.Selector = Class.create({
    initialize: function(expression) {
      this.expression = expression.strip();
    },

    findElements: function(rootElement) {
      return Prototype.Selector.select(this.expression, rootElement);
    },

    match: function(element) {
      return Prototype.Selector.match(element, this.expression);
    },

    toString: function() {
      return this.expression;
    },

    inspect: function() {
      return "#<Selector: " + this.expression + ">";
    }
  });

  Object.extend(Selector, {
    matchElements: function(elements, expression) {
      var match = Prototype.Selector.match,
          results = [];

      for (var i = 0, length = elements.length; i < length; i++) {
        var element = elements[i];
        if (match(element, expression)) {
          results.push(Element.extend(element));
        }
      }
      return results;
    },

    findElement: function(elements, expression, index) {
      index = index || 0;
      var matchIndex = 0, element;
      for (var i = 0, length = elements.length; i < length; i++) {
        element = elements[i];
        if (Prototype.Selector.match(element, expression) && index === matchIndex++) {
          return Element.extend(element);
        }
      }
    },

    findChildElements: function(element, expressions) {
      var selector = expressions.toArray().join(', ');
      return Prototype.Selector.select(selector, element || document);
    }
  });
})();
/*! jQuery v3.5.1 | (c) JS Foundation and other contributors | jquery.org/license */
!function(e,t){"use strict";"object"==typeof module&&"object"==typeof module.exports?module.exports=e.document?t(e,!0):function(e){if(!e.document)throw new Error("jQuery requires a window with a document");return t(e)}:t(e)}("undefined"!=typeof window?window:this,function(C,e){"use strict";var t=[],r=Object.getPrototypeOf,s=t.slice,g=t.flat?function(e){return t.flat.call(e)}:function(e){return t.concat.apply([],e)},u=t.push,i=t.indexOf,n={},o=n.toString,v=n.hasOwnProperty,a=v.toString,l=a.call(Object),y={},m=function(e){return"function"==typeof e&&"number"!=typeof e.nodeType},x=function(e){return null!=e&&e===e.window},E=C.document,c={type:!0,src:!0,nonce:!0,noModule:!0};function b(e,t,n){var r,i,o=(n=n||E).createElement("script");if(o.text=e,t)for(r in c)(i=t[r]||t.getAttribute&&t.getAttribute(r))&&o.setAttribute(r,i);n.head.appendChild(o).parentNode.removeChild(o)}function w(e){return null==e?e+"":"object"==typeof e||"function"==typeof e?n[o.call(e)]||"object":typeof e}var f="3.5.1",S=function(e,t){return new S.fn.init(e,t)};function p(e){var t=!!e&&"length"in e&&e.length,n=w(e);return!m(e)&&!x(e)&&("array"===n||0===t||"number"==typeof t&&0<t&&t-1 in e)}S.fn=S.prototype={jquery:f,constructor:S,length:0,toArray:function(){return s.call(this)},get:function(e){return null==e?s.call(this):e<0?this[e+this.length]:this[e]},pushStack:function(e){var t=S.merge(this.constructor(),e);return t.prevObject=this,t},each:function(e){return S.each(this,e)},map:function(n){return this.pushStack(S.map(this,function(e,t){return n.call(e,t,e)}))},slice:function(){return this.pushStack(s.apply(this,arguments))},first:function(){return this.eq(0)},last:function(){return this.eq(-1)},even:function(){return this.pushStack(S.grep(this,function(e,t){return(t+1)%2}))},odd:function(){return this.pushStack(S.grep(this,function(e,t){return t%2}))},eq:function(e){var t=this.length,n=+e+(e<0?t:0);return this.pushStack(0<=n&&n<t?[this[n]]:[])},end:function(){return this.prevObject||this.constructor()},push:u,sort:t.sort,splice:t.splice},S.extend=S.fn.extend=function(){var e,t,n,r,i,o,a=arguments[0]||{},s=1,u=arguments.length,l=!1;for("boolean"==typeof a&&(l=a,a=arguments[s]||{},s++),"object"==typeof a||m(a)||(a={}),s===u&&(a=this,s--);s<u;s++)if(null!=(e=arguments[s]))for(t in e)r=e[t],"__proto__"!==t&&a!==r&&(l&&r&&(S.isPlainObject(r)||(i=Array.isArray(r)))?(n=a[t],o=i&&!Array.isArray(n)?[]:i||S.isPlainObject(n)?n:{},i=!1,a[t]=S.extend(l,o,r)):void 0!==r&&(a[t]=r));return a},S.extend({expando:"jQuery"+(f+Math.random()).replace(/\D/g,""),isReady:!0,error:function(e){throw new Error(e)},noop:function(){},isPlainObject:function(e){var t,n;return!(!e||"[object Object]"!==o.call(e))&&(!(t=r(e))||"function"==typeof(n=v.call(t,"constructor")&&t.constructor)&&a.call(n)===l)},isEmptyObject:function(e){var t;for(t in e)return!1;return!0},globalEval:function(e,t,n){b(e,{nonce:t&&t.nonce},n)},each:function(e,t){var n,r=0;if(p(e)){for(n=e.length;r<n;r++)if(!1===t.call(e[r],r,e[r]))break}else for(r in e)if(!1===t.call(e[r],r,e[r]))break;return e},makeArray:function(e,t){var n=t||[];return null!=e&&(p(Object(e))?S.merge(n,"string"==typeof e?[e]:e):u.call(n,e)),n},inArray:function(e,t,n){return null==t?-1:i.call(t,e,n)},merge:function(e,t){for(var n=+t.length,r=0,i=e.length;r<n;r++)e[i++]=t[r];return e.length=i,e},grep:function(e,t,n){for(var r=[],i=0,o=e.length,a=!n;i<o;i++)!t(e[i],i)!==a&&r.push(e[i]);return r},map:function(e,t,n){var r,i,o=0,a=[];if(p(e))for(r=e.length;o<r;o++)null!=(i=t(e[o],o,n))&&a.push(i);else for(o in e)null!=(i=t(e[o],o,n))&&a.push(i);return g(a)},guid:1,support:y}),"function"==typeof Symbol&&(S.fn[Symbol.iterator]=t[Symbol.iterator]),S.each("Boolean Number String Function Array Date RegExp Object Error Symbol".split(" "),function(e,t){n["[object "+t+"]"]=t.toLowerCase()});var d=function(n){var e,d,b,o,i,h,f,g,w,u,l,T,C,a,E,v,s,c,y,S="sizzle"+1*new Date,p=n.document,k=0,r=0,m=ue(),x=ue(),A=ue(),N=ue(),D=function(e,t){return e===t&&(l=!0),0},j={}.hasOwnProperty,t=[],q=t.pop,L=t.push,H=t.push,O=t.slice,P=function(e,t){for(var n=0,r=e.length;n<r;n++)if(e[n]===t)return n;return-1},R="checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|loop|multiple|open|readonly|required|scoped",M="[\\x20\\t\\r\\n\\f]",I="(?:\\\\[\\da-fA-F]{1,6}"+M+"?|\\\\[^\\r\\n\\f]|[\\w-]|[^\0-\\x7f])+",W="\\["+M+"*("+I+")(?:"+M+"*([*^$|!~]?=)"+M+"*(?:'((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\"|("+I+"))|)"+M+"*\\]",F=":("+I+")(?:\\((('((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\")|((?:\\\\.|[^\\\\()[\\]]|"+W+")*)|.*)\\)|)",B=new RegExp(M+"+","g"),$=new RegExp("^"+M+"+|((?:^|[^\\\\])(?:\\\\.)*)"+M+"+$","g"),_=new RegExp("^"+M+"*,"+M+"*"),z=new RegExp("^"+M+"*([>+~]|"+M+")"+M+"*"),U=new RegExp(M+"|>"),X=new RegExp(F),V=new RegExp("^"+I+"$"),G={ID:new RegExp("^#("+I+")"),CLASS:new RegExp("^\\.("+I+")"),TAG:new RegExp("^("+I+"|[*])"),ATTR:new RegExp("^"+W),PSEUDO:new RegExp("^"+F),CHILD:new RegExp("^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\("+M+"*(even|odd|(([+-]|)(\\d*)n|)"+M+"*(?:([+-]|)"+M+"*(\\d+)|))"+M+"*\\)|)","i"),bool:new RegExp("^(?:"+R+")$","i"),needsContext:new RegExp("^"+M+"*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\("+M+"*((?:-\\d)?\\d*)"+M+"*\\)|)(?=[^-]|$)","i")},Y=/HTML$/i,Q=/^(?:input|select|textarea|button)$/i,J=/^h\d$/i,K=/^[^{]+\{\s*\[native \w/,Z=/^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,ee=/[+~]/,te=new RegExp("\\\\[\\da-fA-F]{1,6}"+M+"?|\\\\([^\\r\\n\\f])","g"),ne=function(e,t){var n="0x"+e.slice(1)-65536;return t||(n<0?String.fromCharCode(n+65536):String.fromCharCode(n>>10|55296,1023&n|56320))},re=/([\0-\x1f\x7f]|^-?\d)|^-$|[^\0-\x1f\x7f-\uFFFF\w-]/g,ie=function(e,t){return t?"\0"===e?"\ufffd":e.slice(0,-1)+"\\"+e.charCodeAt(e.length-1).toString(16)+" ":"\\"+e},oe=function(){T()},ae=be(function(e){return!0===e.disabled&&"fieldset"===e.nodeName.toLowerCase()},{dir:"parentNode",next:"legend"});try{H.apply(t=O.call(p.childNodes),p.childNodes),t[p.childNodes.length].nodeType}catch(e){H={apply:t.length?function(e,t){L.apply(e,O.call(t))}:function(e,t){var n=e.length,r=0;while(e[n++]=t[r++]);e.length=n-1}}}function se(t,e,n,r){var i,o,a,s,u,l,c,f=e&&e.ownerDocument,p=e?e.nodeType:9;if(n=n||[],"string"!=typeof t||!t||1!==p&&9!==p&&11!==p)return n;if(!r&&(T(e),e=e||C,E)){if(11!==p&&(u=Z.exec(t)))if(i=u[1]){if(9===p){if(!(a=e.getElementById(i)))return n;if(a.id===i)return n.push(a),n}else if(f&&(a=f.getElementById(i))&&y(e,a)&&a.id===i)return n.push(a),n}else{if(u[2])return H.apply(n,e.getElementsByTagName(t)),n;if((i=u[3])&&d.getElementsByClassName&&e.getElementsByClassName)return H.apply(n,e.getElementsByClassName(i)),n}if(d.qsa&&!N[t+" "]&&(!v||!v.test(t))&&(1!==p||"object"!==e.nodeName.toLowerCase())){if(c=t,f=e,1===p&&(U.test(t)||z.test(t))){(f=ee.test(t)&&ye(e.parentNode)||e)===e&&d.scope||((s=e.getAttribute("id"))?s=s.replace(re,ie):e.setAttribute("id",s=S)),o=(l=h(t)).length;while(o--)l[o]=(s?"#"+s:":scope")+" "+xe(l[o]);c=l.join(",")}try{return H.apply(n,f.querySelectorAll(c)),n}catch(e){N(t,!0)}finally{s===S&&e.removeAttribute("id")}}}return g(t.replace($,"$1"),e,n,r)}function ue(){var r=[];return function e(t,n){return r.push(t+" ")>b.cacheLength&&delete e[r.shift()],e[t+" "]=n}}function le(e){return e[S]=!0,e}function ce(e){var t=C.createElement("fieldset");try{return!!e(t)}catch(e){return!1}finally{t.parentNode&&t.parentNode.removeChild(t),t=null}}function fe(e,t){var n=e.split("|"),r=n.length;while(r--)b.attrHandle[n[r]]=t}function pe(e,t){var n=t&&e,r=n&&1===e.nodeType&&1===t.nodeType&&e.sourceIndex-t.sourceIndex;if(r)return r;if(n)while(n=n.nextSibling)if(n===t)return-1;return e?1:-1}function de(t){return function(e){return"input"===e.nodeName.toLowerCase()&&e.type===t}}function he(n){return function(e){var t=e.nodeName.toLowerCase();return("input"===t||"button"===t)&&e.type===n}}function ge(t){return function(e){return"form"in e?e.parentNode&&!1===e.disabled?"label"in e?"label"in e.parentNode?e.parentNode.disabled===t:e.disabled===t:e.isDisabled===t||e.isDisabled!==!t&&ae(e)===t:e.disabled===t:"label"in e&&e.disabled===t}}function ve(a){return le(function(o){return o=+o,le(function(e,t){var n,r=a([],e.length,o),i=r.length;while(i--)e[n=r[i]]&&(e[n]=!(t[n]=e[n]))})})}function ye(e){return e&&"undefined"!=typeof e.getElementsByTagName&&e}for(e in d=se.support={},i=se.isXML=function(e){var t=e.namespaceURI,n=(e.ownerDocument||e).documentElement;return!Y.test(t||n&&n.nodeName||"HTML")},T=se.setDocument=function(e){var t,n,r=e?e.ownerDocument||e:p;return r!=C&&9===r.nodeType&&r.documentElement&&(a=(C=r).documentElement,E=!i(C),p!=C&&(n=C.defaultView)&&n.top!==n&&(n.addEventListener?n.addEventListener("unload",oe,!1):n.attachEvent&&n.attachEvent("onunload",oe)),d.scope=ce(function(e){return a.appendChild(e).appendChild(C.createElement("div")),"undefined"!=typeof e.querySelectorAll&&!e.querySelectorAll(":scope fieldset div").length}),d.attributes=ce(function(e){return e.className="i",!e.getAttribute("className")}),d.getElementsByTagName=ce(function(e){return e.appendChild(C.createComment("")),!e.getElementsByTagName("*").length}),d.getElementsByClassName=K.test(C.getElementsByClassName),d.getById=ce(function(e){return a.appendChild(e).id=S,!C.getElementsByName||!C.getElementsByName(S).length}),d.getById?(b.filter.ID=function(e){var t=e.replace(te,ne);return function(e){return e.getAttribute("id")===t}},b.find.ID=function(e,t){if("undefined"!=typeof t.getElementById&&E){var n=t.getElementById(e);return n?[n]:[]}}):(b.filter.ID=function(e){var n=e.replace(te,ne);return function(e){var t="undefined"!=typeof e.getAttributeNode&&e.getAttributeNode("id");return t&&t.value===n}},b.find.ID=function(e,t){if("undefined"!=typeof t.getElementById&&E){var n,r,i,o=t.getElementById(e);if(o){if((n=o.getAttributeNode("id"))&&n.value===e)return[o];i=t.getElementsByName(e),r=0;while(o=i[r++])if((n=o.getAttributeNode("id"))&&n.value===e)return[o]}return[]}}),b.find.TAG=d.getElementsByTagName?function(e,t){return"undefined"!=typeof t.getElementsByTagName?t.getElementsByTagName(e):d.qsa?t.querySelectorAll(e):void 0}:function(e,t){var n,r=[],i=0,o=t.getElementsByTagName(e);if("*"===e){while(n=o[i++])1===n.nodeType&&r.push(n);return r}return o},b.find.CLASS=d.getElementsByClassName&&function(e,t){if("undefined"!=typeof t.getElementsByClassName&&E)return t.getElementsByClassName(e)},s=[],v=[],(d.qsa=K.test(C.querySelectorAll))&&(ce(function(e){var t;a.appendChild(e).innerHTML="<a id='"+S+"'></a><select id='"+S+"-\r\\' msallowcapture=''><option selected=''></option></select>",e.querySelectorAll("[msallowcapture^='']").length&&v.push("[*^$]="+M+"*(?:''|\"\")"),e.querySelectorAll("[selected]").length||v.push("\\["+M+"*(?:value|"+R+")"),e.querySelectorAll("[id~="+S+"-]").length||v.push("~="),(t=C.createElement("input")).setAttribute("name",""),e.appendChild(t),e.querySelectorAll("[name='']").length||v.push("\\["+M+"*name"+M+"*="+M+"*(?:''|\"\")"),e.querySelectorAll(":checked").length||v.push(":checked"),e.querySelectorAll("a#"+S+"+*").length||v.push(".#.+[+~]"),e.querySelectorAll("\\\f"),v.push("[\\r\\n\\f]")}),ce(function(e){e.innerHTML="<a href='' disabled='disabled'></a><select disabled='disabled'><option/></select>";var t=C.createElement("input");t.setAttribute("type","hidden"),e.appendChild(t).setAttribute("name","D"),e.querySelectorAll("[name=d]").length&&v.push("name"+M+"*[*^$|!~]?="),2!==e.querySelectorAll(":enabled").length&&v.push(":enabled",":disabled"),a.appendChild(e).disabled=!0,2!==e.querySelectorAll(":disabled").length&&v.push(":enabled",":disabled"),e.querySelectorAll("*,:x"),v.push(",.*:")})),(d.matchesSelector=K.test(c=a.matches||a.webkitMatchesSelector||a.mozMatchesSelector||a.oMatchesSelector||a.msMatchesSelector))&&ce(function(e){d.disconnectedMatch=c.call(e,"*"),c.call(e,"[s!='']:x"),s.push("!=",F)}),v=v.length&&new RegExp(v.join("|")),s=s.length&&new RegExp(s.join("|")),t=K.test(a.compareDocumentPosition),y=t||K.test(a.contains)?function(e,t){var n=9===e.nodeType?e.documentElement:e,r=t&&t.parentNode;return e===r||!(!r||1!==r.nodeType||!(n.contains?n.contains(r):e.compareDocumentPosition&&16&e.compareDocumentPosition(r)))}:function(e,t){if(t)while(t=t.parentNode)if(t===e)return!0;return!1},D=t?function(e,t){if(e===t)return l=!0,0;var n=!e.compareDocumentPosition-!t.compareDocumentPosition;return n||(1&(n=(e.ownerDocument||e)==(t.ownerDocument||t)?e.compareDocumentPosition(t):1)||!d.sortDetached&&t.compareDocumentPosition(e)===n?e==C||e.ownerDocument==p&&y(p,e)?-1:t==C||t.ownerDocument==p&&y(p,t)?1:u?P(u,e)-P(u,t):0:4&n?-1:1)}:function(e,t){if(e===t)return l=!0,0;var n,r=0,i=e.parentNode,o=t.parentNode,a=[e],s=[t];if(!i||!o)return e==C?-1:t==C?1:i?-1:o?1:u?P(u,e)-P(u,t):0;if(i===o)return pe(e,t);n=e;while(n=n.parentNode)a.unshift(n);n=t;while(n=n.parentNode)s.unshift(n);while(a[r]===s[r])r++;return r?pe(a[r],s[r]):a[r]==p?-1:s[r]==p?1:0}),C},se.matches=function(e,t){return se(e,null,null,t)},se.matchesSelector=function(e,t){if(T(e),d.matchesSelector&&E&&!N[t+" "]&&(!s||!s.test(t))&&(!v||!v.test(t)))try{var n=c.call(e,t);if(n||d.disconnectedMatch||e.document&&11!==e.document.nodeType)return n}catch(e){N(t,!0)}return 0<se(t,C,null,[e]).length},se.contains=function(e,t){return(e.ownerDocument||e)!=C&&T(e),y(e,t)},se.attr=function(e,t){(e.ownerDocument||e)!=C&&T(e);var n=b.attrHandle[t.toLowerCase()],r=n&&j.call(b.attrHandle,t.toLowerCase())?n(e,t,!E):void 0;return void 0!==r?r:d.attributes||!E?e.getAttribute(t):(r=e.getAttributeNode(t))&&r.specified?r.value:null},se.escape=function(e){return(e+"").replace(re,ie)},se.error=function(e){throw new Error("Syntax error, unrecognized expression: "+e)},se.uniqueSort=function(e){var t,n=[],r=0,i=0;if(l=!d.detectDuplicates,u=!d.sortStable&&e.slice(0),e.sort(D),l){while(t=e[i++])t===e[i]&&(r=n.push(i));while(r--)e.splice(n[r],1)}return u=null,e},o=se.getText=function(e){var t,n="",r=0,i=e.nodeType;if(i){if(1===i||9===i||11===i){if("string"==typeof e.textContent)return e.textContent;for(e=e.firstChild;e;e=e.nextSibling)n+=o(e)}else if(3===i||4===i)return e.nodeValue}else while(t=e[r++])n+=o(t);return n},(b=se.selectors={cacheLength:50,createPseudo:le,match:G,attrHandle:{},find:{},relative:{">":{dir:"parentNode",first:!0}," ":{dir:"parentNode"},"+":{dir:"previousSibling",first:!0},"~":{dir:"previousSibling"}},preFilter:{ATTR:function(e){return e[1]=e[1].replace(te,ne),e[3]=(e[3]||e[4]||e[5]||"").replace(te,ne),"~="===e[2]&&(e[3]=" "+e[3]+" "),e.slice(0,4)},CHILD:function(e){return e[1]=e[1].toLowerCase(),"nth"===e[1].slice(0,3)?(e[3]||se.error(e[0]),e[4]=+(e[4]?e[5]+(e[6]||1):2*("even"===e[3]||"odd"===e[3])),e[5]=+(e[7]+e[8]||"odd"===e[3])):e[3]&&se.error(e[0]),e},PSEUDO:function(e){var t,n=!e[6]&&e[2];return G.CHILD.test(e[0])?null:(e[3]?e[2]=e[4]||e[5]||"":n&&X.test(n)&&(t=h(n,!0))&&(t=n.indexOf(")",n.length-t)-n.length)&&(e[0]=e[0].slice(0,t),e[2]=n.slice(0,t)),e.slice(0,3))}},filter:{TAG:function(e){var t=e.replace(te,ne).toLowerCase();return"*"===e?function(){return!0}:function(e){return e.nodeName&&e.nodeName.toLowerCase()===t}},CLASS:function(e){var t=m[e+" "];return t||(t=new RegExp("(^|"+M+")"+e+"("+M+"|$)"))&&m(e,function(e){return t.test("string"==typeof e.className&&e.className||"undefined"!=typeof e.getAttribute&&e.getAttribute("class")||"")})},ATTR:function(n,r,i){return function(e){var t=se.attr(e,n);return null==t?"!="===r:!r||(t+="","="===r?t===i:"!="===r?t!==i:"^="===r?i&&0===t.indexOf(i):"*="===r?i&&-1<t.indexOf(i):"$="===r?i&&t.slice(-i.length)===i:"~="===r?-1<(" "+t.replace(B," ")+" ").indexOf(i):"|="===r&&(t===i||t.slice(0,i.length+1)===i+"-"))}},CHILD:function(h,e,t,g,v){var y="nth"!==h.slice(0,3),m="last"!==h.slice(-4),x="of-type"===e;return 1===g&&0===v?function(e){return!!e.parentNode}:function(e,t,n){var r,i,o,a,s,u,l=y!==m?"nextSibling":"previousSibling",c=e.parentNode,f=x&&e.nodeName.toLowerCase(),p=!n&&!x,d=!1;if(c){if(y){while(l){a=e;while(a=a[l])if(x?a.nodeName.toLowerCase()===f:1===a.nodeType)return!1;u=l="only"===h&&!u&&"nextSibling"}return!0}if(u=[m?c.firstChild:c.lastChild],m&&p){d=(s=(r=(i=(o=(a=c)[S]||(a[S]={}))[a.uniqueID]||(o[a.uniqueID]={}))[h]||[])[0]===k&&r[1])&&r[2],a=s&&c.childNodes[s];while(a=++s&&a&&a[l]||(d=s=0)||u.pop())if(1===a.nodeType&&++d&&a===e){i[h]=[k,s,d];break}}else if(p&&(d=s=(r=(i=(o=(a=e)[S]||(a[S]={}))[a.uniqueID]||(o[a.uniqueID]={}))[h]||[])[0]===k&&r[1]),!1===d)while(a=++s&&a&&a[l]||(d=s=0)||u.pop())if((x?a.nodeName.toLowerCase()===f:1===a.nodeType)&&++d&&(p&&((i=(o=a[S]||(a[S]={}))[a.uniqueID]||(o[a.uniqueID]={}))[h]=[k,d]),a===e))break;return(d-=v)===g||d%g==0&&0<=d/g}}},PSEUDO:function(e,o){var t,a=b.pseudos[e]||b.setFilters[e.toLowerCase()]||se.error("unsupported pseudo: "+e);return a[S]?a(o):1<a.length?(t=[e,e,"",o],b.setFilters.hasOwnProperty(e.toLowerCase())?le(function(e,t){var n,r=a(e,o),i=r.length;while(i--)e[n=P(e,r[i])]=!(t[n]=r[i])}):function(e){return a(e,0,t)}):a}},pseudos:{not:le(function(e){var r=[],i=[],s=f(e.replace($,"$1"));return s[S]?le(function(e,t,n,r){var i,o=s(e,null,r,[]),a=e.length;while(a--)(i=o[a])&&(e[a]=!(t[a]=i))}):function(e,t,n){return r[0]=e,s(r,null,n,i),r[0]=null,!i.pop()}}),has:le(function(t){return function(e){return 0<se(t,e).length}}),contains:le(function(t){return t=t.replace(te,ne),function(e){return-1<(e.textContent||o(e)).indexOf(t)}}),lang:le(function(n){return V.test(n||"")||se.error("unsupported lang: "+n),n=n.replace(te,ne).toLowerCase(),function(e){var t;do{if(t=E?e.lang:e.getAttribute("xml:lang")||e.getAttribute("lang"))return(t=t.toLowerCase())===n||0===t.indexOf(n+"-")}while((e=e.parentNode)&&1===e.nodeType);return!1}}),target:function(e){var t=n.location&&n.location.hash;return t&&t.slice(1)===e.id},root:function(e){return e===a},focus:function(e){return e===C.activeElement&&(!C.hasFocus||C.hasFocus())&&!!(e.type||e.href||~e.tabIndex)},enabled:ge(!1),disabled:ge(!0),checked:function(e){var t=e.nodeName.toLowerCase();return"input"===t&&!!e.checked||"option"===t&&!!e.selected},selected:function(e){return e.parentNode&&e.parentNode.selectedIndex,!0===e.selected},empty:function(e){for(e=e.firstChild;e;e=e.nextSibling)if(e.nodeType<6)return!1;return!0},parent:function(e){return!b.pseudos.empty(e)},header:function(e){return J.test(e.nodeName)},input:function(e){return Q.test(e.nodeName)},button:function(e){var t=e.nodeName.toLowerCase();return"input"===t&&"button"===e.type||"button"===t},text:function(e){var t;return"input"===e.nodeName.toLowerCase()&&"text"===e.type&&(null==(t=e.getAttribute("type"))||"text"===t.toLowerCase())},first:ve(function(){return[0]}),last:ve(function(e,t){return[t-1]}),eq:ve(function(e,t,n){return[n<0?n+t:n]}),even:ve(function(e,t){for(var n=0;n<t;n+=2)e.push(n);return e}),odd:ve(function(e,t){for(var n=1;n<t;n+=2)e.push(n);return e}),lt:ve(function(e,t,n){for(var r=n<0?n+t:t<n?t:n;0<=--r;)e.push(r);return e}),gt:ve(function(e,t,n){for(var r=n<0?n+t:n;++r<t;)e.push(r);return e})}}).pseudos.nth=b.pseudos.eq,{radio:!0,checkbox:!0,file:!0,password:!0,image:!0})b.pseudos[e]=de(e);for(e in{submit:!0,reset:!0})b.pseudos[e]=he(e);function me(){}function xe(e){for(var t=0,n=e.length,r="";t<n;t++)r+=e[t].value;return r}function be(s,e,t){var u=e.dir,l=e.next,c=l||u,f=t&&"parentNode"===c,p=r++;return e.first?function(e,t,n){while(e=e[u])if(1===e.nodeType||f)return s(e,t,n);return!1}:function(e,t,n){var r,i,o,a=[k,p];if(n){while(e=e[u])if((1===e.nodeType||f)&&s(e,t,n))return!0}else while(e=e[u])if(1===e.nodeType||f)if(i=(o=e[S]||(e[S]={}))[e.uniqueID]||(o[e.uniqueID]={}),l&&l===e.nodeName.toLowerCase())e=e[u]||e;else{if((r=i[c])&&r[0]===k&&r[1]===p)return a[2]=r[2];if((i[c]=a)[2]=s(e,t,n))return!0}return!1}}function we(i){return 1<i.length?function(e,t,n){var r=i.length;while(r--)if(!i[r](e,t,n))return!1;return!0}:i[0]}function Te(e,t,n,r,i){for(var o,a=[],s=0,u=e.length,l=null!=t;s<u;s++)(o=e[s])&&(n&&!n(o,r,i)||(a.push(o),l&&t.push(s)));return a}function Ce(d,h,g,v,y,e){return v&&!v[S]&&(v=Ce(v)),y&&!y[S]&&(y=Ce(y,e)),le(function(e,t,n,r){var i,o,a,s=[],u=[],l=t.length,c=e||function(e,t,n){for(var r=0,i=t.length;r<i;r++)se(e,t[r],n);return n}(h||"*",n.nodeType?[n]:n,[]),f=!d||!e&&h?c:Te(c,s,d,n,r),p=g?y||(e?d:l||v)?[]:t:f;if(g&&g(f,p,n,r),v){i=Te(p,u),v(i,[],n,r),o=i.length;while(o--)(a=i[o])&&(p[u[o]]=!(f[u[o]]=a))}if(e){if(y||d){if(y){i=[],o=p.length;while(o--)(a=p[o])&&i.push(f[o]=a);y(null,p=[],i,r)}o=p.length;while(o--)(a=p[o])&&-1<(i=y?P(e,a):s[o])&&(e[i]=!(t[i]=a))}}else p=Te(p===t?p.splice(l,p.length):p),y?y(null,t,p,r):H.apply(t,p)})}function Ee(e){for(var i,t,n,r=e.length,o=b.relative[e[0].type],a=o||b.relative[" "],s=o?1:0,u=be(function(e){return e===i},a,!0),l=be(function(e){return-1<P(i,e)},a,!0),c=[function(e,t,n){var r=!o&&(n||t!==w)||((i=t).nodeType?u(e,t,n):l(e,t,n));return i=null,r}];s<r;s++)if(t=b.relative[e[s].type])c=[be(we(c),t)];else{if((t=b.filter[e[s].type].apply(null,e[s].matches))[S]){for(n=++s;n<r;n++)if(b.relative[e[n].type])break;return Ce(1<s&&we(c),1<s&&xe(e.slice(0,s-1).concat({value:" "===e[s-2].type?"*":""})).replace($,"$1"),t,s<n&&Ee(e.slice(s,n)),n<r&&Ee(e=e.slice(n)),n<r&&xe(e))}c.push(t)}return we(c)}return me.prototype=b.filters=b.pseudos,b.setFilters=new me,h=se.tokenize=function(e,t){var n,r,i,o,a,s,u,l=x[e+" "];if(l)return t?0:l.slice(0);a=e,s=[],u=b.preFilter;while(a){for(o in n&&!(r=_.exec(a))||(r&&(a=a.slice(r[0].length)||a),s.push(i=[])),n=!1,(r=z.exec(a))&&(n=r.shift(),i.push({value:n,type:r[0].replace($," ")}),a=a.slice(n.length)),b.filter)!(r=G[o].exec(a))||u[o]&&!(r=u[o](r))||(n=r.shift(),i.push({value:n,type:o,matches:r}),a=a.slice(n.length));if(!n)break}return t?a.length:a?se.error(e):x(e,s).slice(0)},f=se.compile=function(e,t){var n,v,y,m,x,r,i=[],o=[],a=A[e+" "];if(!a){t||(t=h(e)),n=t.length;while(n--)(a=Ee(t[n]))[S]?i.push(a):o.push(a);(a=A(e,(v=o,m=0<(y=i).length,x=0<v.length,r=function(e,t,n,r,i){var o,a,s,u=0,l="0",c=e&&[],f=[],p=w,d=e||x&&b.find.TAG("*",i),h=k+=null==p?1:Math.random()||.1,g=d.length;for(i&&(w=t==C||t||i);l!==g&&null!=(o=d[l]);l++){if(x&&o){a=0,t||o.ownerDocument==C||(T(o),n=!E);while(s=v[a++])if(s(o,t||C,n)){r.push(o);break}i&&(k=h)}m&&((o=!s&&o)&&u--,e&&c.push(o))}if(u+=l,m&&l!==u){a=0;while(s=y[a++])s(c,f,t,n);if(e){if(0<u)while(l--)c[l]||f[l]||(f[l]=q.call(r));f=Te(f)}H.apply(r,f),i&&!e&&0<f.length&&1<u+y.length&&se.uniqueSort(r)}return i&&(k=h,w=p),c},m?le(r):r))).selector=e}return a},g=se.select=function(e,t,n,r){var i,o,a,s,u,l="function"==typeof e&&e,c=!r&&h(e=l.selector||e);if(n=n||[],1===c.length){if(2<(o=c[0]=c[0].slice(0)).length&&"ID"===(a=o[0]).type&&9===t.nodeType&&E&&b.relative[o[1].type]){if(!(t=(b.find.ID(a.matches[0].replace(te,ne),t)||[])[0]))return n;l&&(t=t.parentNode),e=e.slice(o.shift().value.length)}i=G.needsContext.test(e)?0:o.length;while(i--){if(a=o[i],b.relative[s=a.type])break;if((u=b.find[s])&&(r=u(a.matches[0].replace(te,ne),ee.test(o[0].type)&&ye(t.parentNode)||t))){if(o.splice(i,1),!(e=r.length&&xe(o)))return H.apply(n,r),n;break}}}return(l||f(e,c))(r,t,!E,n,!t||ee.test(e)&&ye(t.parentNode)||t),n},d.sortStable=S.split("").sort(D).join("")===S,d.detectDuplicates=!!l,T(),d.sortDetached=ce(function(e){return 1&e.compareDocumentPosition(C.createElement("fieldset"))}),ce(function(e){return e.innerHTML="<a href='#'></a>","#"===e.firstChild.getAttribute("href")})||fe("type|href|height|width",function(e,t,n){if(!n)return e.getAttribute(t,"type"===t.toLowerCase()?1:2)}),d.attributes&&ce(function(e){return e.innerHTML="<input/>",e.firstChild.setAttribute("value",""),""===e.firstChild.getAttribute("value")})||fe("value",function(e,t,n){if(!n&&"input"===e.nodeName.toLowerCase())return e.defaultValue}),ce(function(e){return null==e.getAttribute("disabled")})||fe(R,function(e,t,n){var r;if(!n)return!0===e[t]?t.toLowerCase():(r=e.getAttributeNode(t))&&r.specified?r.value:null}),se}(C);S.find=d,S.expr=d.selectors,S.expr[":"]=S.expr.pseudos,S.uniqueSort=S.unique=d.uniqueSort,S.text=d.getText,S.isXMLDoc=d.isXML,S.contains=d.contains,S.escapeSelector=d.escape;var h=function(e,t,n){var r=[],i=void 0!==n;while((e=e[t])&&9!==e.nodeType)if(1===e.nodeType){if(i&&S(e).is(n))break;r.push(e)}return r},T=function(e,t){for(var n=[];e;e=e.nextSibling)1===e.nodeType&&e!==t&&n.push(e);return n},k=S.expr.match.needsContext;function A(e,t){return e.nodeName&&e.nodeName.toLowerCase()===t.toLowerCase()}var N=/^<([a-z][^\/\0>:\x20\t\r\n\f]*)[\x20\t\r\n\f]*\/?>(?:<\/\1>|)$/i;function D(e,n,r){return m(n)?S.grep(e,function(e,t){return!!n.call(e,t,e)!==r}):n.nodeType?S.grep(e,function(e){return e===n!==r}):"string"!=typeof n?S.grep(e,function(e){return-1<i.call(n,e)!==r}):S.filter(n,e,r)}S.filter=function(e,t,n){var r=t[0];return n&&(e=":not("+e+")"),1===t.length&&1===r.nodeType?S.find.matchesSelector(r,e)?[r]:[]:S.find.matches(e,S.grep(t,function(e){return 1===e.nodeType}))},S.fn.extend({find:function(e){var t,n,r=this.length,i=this;if("string"!=typeof e)return this.pushStack(S(e).filter(function(){for(t=0;t<r;t++)if(S.contains(i[t],this))return!0}));for(n=this.pushStack([]),t=0;t<r;t++)S.find(e,i[t],n);return 1<r?S.uniqueSort(n):n},filter:function(e){return this.pushStack(D(this,e||[],!1))},not:function(e){return this.pushStack(D(this,e||[],!0))},is:function(e){return!!D(this,"string"==typeof e&&k.test(e)?S(e):e||[],!1).length}});var j,q=/^(?:\s*(<[\w\W]+>)[^>]*|#([\w-]+))$/;(S.fn.init=function(e,t,n){var r,i;if(!e)return this;if(n=n||j,"string"==typeof e){if(!(r="<"===e[0]&&">"===e[e.length-1]&&3<=e.length?[null,e,null]:q.exec(e))||!r[1]&&t)return!t||t.jquery?(t||n).find(e):this.constructor(t).find(e);if(r[1]){if(t=t instanceof S?t[0]:t,S.merge(this,S.parseHTML(r[1],t&&t.nodeType?t.ownerDocument||t:E,!0)),N.test(r[1])&&S.isPlainObject(t))for(r in t)m(this[r])?this[r](t[r]):this.attr(r,t[r]);return this}return(i=E.getElementById(r[2]))&&(this[0]=i,this.length=1),this}return e.nodeType?(this[0]=e,this.length=1,this):m(e)?void 0!==n.ready?n.ready(e):e(S):S.makeArray(e,this)}).prototype=S.fn,j=S(E);var L=/^(?:parents|prev(?:Until|All))/,H={children:!0,contents:!0,next:!0,prev:!0};function O(e,t){while((e=e[t])&&1!==e.nodeType);return e}S.fn.extend({has:function(e){var t=S(e,this),n=t.length;return this.filter(function(){for(var e=0;e<n;e++)if(S.contains(this,t[e]))return!0})},closest:function(e,t){var n,r=0,i=this.length,o=[],a="string"!=typeof e&&S(e);if(!k.test(e))for(;r<i;r++)for(n=this[r];n&&n!==t;n=n.parentNode)if(n.nodeType<11&&(a?-1<a.index(n):1===n.nodeType&&S.find.matchesSelector(n,e))){o.push(n);break}return this.pushStack(1<o.length?S.uniqueSort(o):o)},index:function(e){return e?"string"==typeof e?i.call(S(e),this[0]):i.call(this,e.jquery?e[0]:e):this[0]&&this[0].parentNode?this.first().prevAll().length:-1},add:function(e,t){return this.pushStack(S.uniqueSort(S.merge(this.get(),S(e,t))))},addBack:function(e){return this.add(null==e?this.prevObject:this.prevObject.filter(e))}}),S.each({parent:function(e){var t=e.parentNode;return t&&11!==t.nodeType?t:null},parents:function(e){return h(e,"parentNode")},parentsUntil:function(e,t,n){return h(e,"parentNode",n)},next:function(e){return O(e,"nextSibling")},prev:function(e){return O(e,"previousSibling")},nextAll:function(e){return h(e,"nextSibling")},prevAll:function(e){return h(e,"previousSibling")},nextUntil:function(e,t,n){return h(e,"nextSibling",n)},prevUntil:function(e,t,n){return h(e,"previousSibling",n)},siblings:function(e){return T((e.parentNode||{}).firstChild,e)},children:function(e){return T(e.firstChild)},contents:function(e){return null!=e.contentDocument&&r(e.contentDocument)?e.contentDocument:(A(e,"template")&&(e=e.content||e),S.merge([],e.childNodes))}},function(r,i){S.fn[r]=function(e,t){var n=S.map(this,i,e);return"Until"!==r.slice(-5)&&(t=e),t&&"string"==typeof t&&(n=S.filter(t,n)),1<this.length&&(H[r]||S.uniqueSort(n),L.test(r)&&n.reverse()),this.pushStack(n)}});var P=/[^\x20\t\r\n\f]+/g;function R(e){return e}function M(e){throw e}function I(e,t,n,r){var i;try{e&&m(i=e.promise)?i.call(e).done(t).fail(n):e&&m(i=e.then)?i.call(e,t,n):t.apply(void 0,[e].slice(r))}catch(e){n.apply(void 0,[e])}}S.Callbacks=function(r){var e,n;r="string"==typeof r?(e=r,n={},S.each(e.match(P)||[],function(e,t){n[t]=!0}),n):S.extend({},r);var i,t,o,a,s=[],u=[],l=-1,c=function(){for(a=a||r.once,o=i=!0;u.length;l=-1){t=u.shift();while(++l<s.length)!1===s[l].apply(t[0],t[1])&&r.stopOnFalse&&(l=s.length,t=!1)}r.memory||(t=!1),i=!1,a&&(s=t?[]:"")},f={add:function(){return s&&(t&&!i&&(l=s.length-1,u.push(t)),function n(e){S.each(e,function(e,t){m(t)?r.unique&&f.has(t)||s.push(t):t&&t.length&&"string"!==w(t)&&n(t)})}(arguments),t&&!i&&c()),this},remove:function(){return S.each(arguments,function(e,t){var n;while(-1<(n=S.inArray(t,s,n)))s.splice(n,1),n<=l&&l--}),this},has:function(e){return e?-1<S.inArray(e,s):0<s.length},empty:function(){return s&&(s=[]),this},disable:function(){return a=u=[],s=t="",this},disabled:function(){return!s},lock:function(){return a=u=[],t||i||(s=t=""),this},locked:function(){return!!a},fireWith:function(e,t){return a||(t=[e,(t=t||[]).slice?t.slice():t],u.push(t),i||c()),this},fire:function(){return f.fireWith(this,arguments),this},fired:function(){return!!o}};return f},S.extend({Deferred:function(e){var o=[["notify","progress",S.Callbacks("memory"),S.Callbacks("memory"),2],["resolve","done",S.Callbacks("once memory"),S.Callbacks("once memory"),0,"resolved"],["reject","fail",S.Callbacks("once memory"),S.Callbacks("once memory"),1,"rejected"]],i="pending",a={state:function(){return i},always:function(){return s.done(arguments).fail(arguments),this},"catch":function(e){return a.then(null,e)},pipe:function(){var i=arguments;return S.Deferred(function(r){S.each(o,function(e,t){var n=m(i[t[4]])&&i[t[4]];s[t[1]](function(){var e=n&&n.apply(this,arguments);e&&m(e.promise)?e.promise().progress(r.notify).done(r.resolve).fail(r.reject):r[t[0]+"With"](this,n?[e]:arguments)})}),i=null}).promise()},then:function(t,n,r){var u=0;function l(i,o,a,s){return function(){var n=this,r=arguments,e=function(){var e,t;if(!(i<u)){if((e=a.apply(n,r))===o.promise())throw new TypeError("Thenable self-resolution");t=e&&("object"==typeof e||"function"==typeof e)&&e.then,m(t)?s?t.call(e,l(u,o,R,s),l(u,o,M,s)):(u++,t.call(e,l(u,o,R,s),l(u,o,M,s),l(u,o,R,o.notifyWith))):(a!==R&&(n=void 0,r=[e]),(s||o.resolveWith)(n,r))}},t=s?e:function(){try{e()}catch(e){S.Deferred.exceptionHook&&S.Deferred.exceptionHook(e,t.stackTrace),u<=i+1&&(a!==M&&(n=void 0,r=[e]),o.rejectWith(n,r))}};i?t():(S.Deferred.getStackHook&&(t.stackTrace=S.Deferred.getStackHook()),C.setTimeout(t))}}return S.Deferred(function(e){o[0][3].add(l(0,e,m(r)?r:R,e.notifyWith)),o[1][3].add(l(0,e,m(t)?t:R)),o[2][3].add(l(0,e,m(n)?n:M))}).promise()},promise:function(e){return null!=e?S.extend(e,a):a}},s={};return S.each(o,function(e,t){var n=t[2],r=t[5];a[t[1]]=n.add,r&&n.add(function(){i=r},o[3-e][2].disable,o[3-e][3].disable,o[0][2].lock,o[0][3].lock),n.add(t[3].fire),s[t[0]]=function(){return s[t[0]+"With"](this===s?void 0:this,arguments),this},s[t[0]+"With"]=n.fireWith}),a.promise(s),e&&e.call(s,s),s},when:function(e){var n=arguments.length,t=n,r=Array(t),i=s.call(arguments),o=S.Deferred(),a=function(t){return function(e){r[t]=this,i[t]=1<arguments.length?s.call(arguments):e,--n||o.resolveWith(r,i)}};if(n<=1&&(I(e,o.done(a(t)).resolve,o.reject,!n),"pending"===o.state()||m(i[t]&&i[t].then)))return o.then();while(t--)I(i[t],a(t),o.reject);return o.promise()}});var W=/^(Eval|Internal|Range|Reference|Syntax|Type|URI)Error$/;S.Deferred.exceptionHook=function(e,t){C.console&&C.console.warn&&e&&W.test(e.name)&&C.console.warn("jQuery.Deferred exception: "+e.message,e.stack,t)},S.readyException=function(e){C.setTimeout(function(){throw e})};var F=S.Deferred();function B(){E.removeEventListener("DOMContentLoaded",B),C.removeEventListener("load",B),S.ready()}S.fn.ready=function(e){return F.then(e)["catch"](function(e){S.readyException(e)}),this},S.extend({isReady:!1,readyWait:1,ready:function(e){(!0===e?--S.readyWait:S.isReady)||(S.isReady=!0)!==e&&0<--S.readyWait||F.resolveWith(E,[S])}}),S.ready.then=F.then,"complete"===E.readyState||"loading"!==E.readyState&&!E.documentElement.doScroll?C.setTimeout(S.ready):(E.addEventListener("DOMContentLoaded",B),C.addEventListener("load",B));var $=function(e,t,n,r,i,o,a){var s=0,u=e.length,l=null==n;if("object"===w(n))for(s in i=!0,n)$(e,t,s,n[s],!0,o,a);else if(void 0!==r&&(i=!0,m(r)||(a=!0),l&&(a?(t.call(e,r),t=null):(l=t,t=function(e,t,n){return l.call(S(e),n)})),t))for(;s<u;s++)t(e[s],n,a?r:r.call(e[s],s,t(e[s],n)));return i?e:l?t.call(e):u?t(e[0],n):o},_=/^-ms-/,z=/-([a-z])/g;function U(e,t){return t.toUpperCase()}function X(e){return e.replace(_,"ms-").replace(z,U)}var V=function(e){return 1===e.nodeType||9===e.nodeType||!+e.nodeType};function G(){this.expando=S.expando+G.uid++}G.uid=1,G.prototype={cache:function(e){var t=e[this.expando];return t||(t={},V(e)&&(e.nodeType?e[this.expando]=t:Object.defineProperty(e,this.expando,{value:t,configurable:!0}))),t},set:function(e,t,n){var r,i=this.cache(e);if("string"==typeof t)i[X(t)]=n;else for(r in t)i[X(r)]=t[r];return i},get:function(e,t){return void 0===t?this.cache(e):e[this.expando]&&e[this.expando][X(t)]},access:function(e,t,n){return void 0===t||t&&"string"==typeof t&&void 0===n?this.get(e,t):(this.set(e,t,n),void 0!==n?n:t)},remove:function(e,t){var n,r=e[this.expando];if(void 0!==r){if(void 0!==t){n=(t=Array.isArray(t)?t.map(X):(t=X(t))in r?[t]:t.match(P)||[]).length;while(n--)delete r[t[n]]}(void 0===t||S.isEmptyObject(r))&&(e.nodeType?e[this.expando]=void 0:delete e[this.expando])}},hasData:function(e){var t=e[this.expando];return void 0!==t&&!S.isEmptyObject(t)}};var Y=new G,Q=new G,J=/^(?:\{[\w\W]*\}|\[[\w\W]*\])$/,K=/[A-Z]/g;function Z(e,t,n){var r,i;if(void 0===n&&1===e.nodeType)if(r="data-"+t.replace(K,"-$&").toLowerCase(),"string"==typeof(n=e.getAttribute(r))){try{n="true"===(i=n)||"false"!==i&&("null"===i?null:i===+i+""?+i:J.test(i)?JSON.parse(i):i)}catch(e){}Q.set(e,t,n)}else n=void 0;return n}S.extend({hasData:function(e){return Q.hasData(e)||Y.hasData(e)},data:function(e,t,n){return Q.access(e,t,n)},removeData:function(e,t){Q.remove(e,t)},_data:function(e,t,n){return Y.access(e,t,n)},_removeData:function(e,t){Y.remove(e,t)}}),S.fn.extend({data:function(n,e){var t,r,i,o=this[0],a=o&&o.attributes;if(void 0===n){if(this.length&&(i=Q.get(o),1===o.nodeType&&!Y.get(o,"hasDataAttrs"))){t=a.length;while(t--)a[t]&&0===(r=a[t].name).indexOf("data-")&&(r=X(r.slice(5)),Z(o,r,i[r]));Y.set(o,"hasDataAttrs",!0)}return i}return"object"==typeof n?this.each(function(){Q.set(this,n)}):$(this,function(e){var t;if(o&&void 0===e)return void 0!==(t=Q.get(o,n))?t:void 0!==(t=Z(o,n))?t:void 0;this.each(function(){Q.set(this,n,e)})},null,e,1<arguments.length,null,!0)},removeData:function(e){return this.each(function(){Q.remove(this,e)})}}),S.extend({queue:function(e,t,n){var r;if(e)return t=(t||"fx")+"queue",r=Y.get(e,t),n&&(!r||Array.isArray(n)?r=Y.access(e,t,S.makeArray(n)):r.push(n)),r||[]},dequeue:function(e,t){t=t||"fx";var n=S.queue(e,t),r=n.length,i=n.shift(),o=S._queueHooks(e,t);"inprogress"===i&&(i=n.shift(),r--),i&&("fx"===t&&n.unshift("inprogress"),delete o.stop,i.call(e,function(){S.dequeue(e,t)},o)),!r&&o&&o.empty.fire()},_queueHooks:function(e,t){var n=t+"queueHooks";return Y.get(e,n)||Y.access(e,n,{empty:S.Callbacks("once memory").add(function(){Y.remove(e,[t+"queue",n])})})}}),S.fn.extend({queue:function(t,n){var e=2;return"string"!=typeof t&&(n=t,t="fx",e--),arguments.length<e?S.queue(this[0],t):void 0===n?this:this.each(function(){var e=S.queue(this,t,n);S._queueHooks(this,t),"fx"===t&&"inprogress"!==e[0]&&S.dequeue(this,t)})},dequeue:function(e){return this.each(function(){S.dequeue(this,e)})},clearQueue:function(e){return this.queue(e||"fx",[])},promise:function(e,t){var n,r=1,i=S.Deferred(),o=this,a=this.length,s=function(){--r||i.resolveWith(o,[o])};"string"!=typeof e&&(t=e,e=void 0),e=e||"fx";while(a--)(n=Y.get(o[a],e+"queueHooks"))&&n.empty&&(r++,n.empty.add(s));return s(),i.promise(t)}});var ee=/[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/.source,te=new RegExp("^(?:([+-])=|)("+ee+")([a-z%]*)$","i"),ne=["Top","Right","Bottom","Left"],re=E.documentElement,ie=function(e){return S.contains(e.ownerDocument,e)},oe={composed:!0};re.getRootNode&&(ie=function(e){return S.contains(e.ownerDocument,e)||e.getRootNode(oe)===e.ownerDocument});var ae=function(e,t){return"none"===(e=t||e).style.display||""===e.style.display&&ie(e)&&"none"===S.css(e,"display")};function se(e,t,n,r){var i,o,a=20,s=r?function(){return r.cur()}:function(){return S.css(e,t,"")},u=s(),l=n&&n[3]||(S.cssNumber[t]?"":"px"),c=e.nodeType&&(S.cssNumber[t]||"px"!==l&&+u)&&te.exec(S.css(e,t));if(c&&c[3]!==l){u/=2,l=l||c[3],c=+u||1;while(a--)S.style(e,t,c+l),(1-o)*(1-(o=s()/u||.5))<=0&&(a=0),c/=o;c*=2,S.style(e,t,c+l),n=n||[]}return n&&(c=+c||+u||0,i=n[1]?c+(n[1]+1)*n[2]:+n[2],r&&(r.unit=l,r.start=c,r.end=i)),i}var ue={};function le(e,t){for(var n,r,i,o,a,s,u,l=[],c=0,f=e.length;c<f;c++)(r=e[c]).style&&(n=r.style.display,t?("none"===n&&(l[c]=Y.get(r,"display")||null,l[c]||(r.style.display="")),""===r.style.display&&ae(r)&&(l[c]=(u=a=o=void 0,a=(i=r).ownerDocument,s=i.nodeName,(u=ue[s])||(o=a.body.appendChild(a.createElement(s)),u=S.css(o,"display"),o.parentNode.removeChild(o),"none"===u&&(u="block"),ue[s]=u)))):"none"!==n&&(l[c]="none",Y.set(r,"display",n)));for(c=0;c<f;c++)null!=l[c]&&(e[c].style.display=l[c]);return e}S.fn.extend({show:function(){return le(this,!0)},hide:function(){return le(this)},toggle:function(e){return"boolean"==typeof e?e?this.show():this.hide():this.each(function(){ae(this)?S(this).show():S(this).hide()})}});var ce,fe,pe=/^(?:checkbox|radio)$/i,de=/<([a-z][^\/\0>\x20\t\r\n\f]*)/i,he=/^$|^module$|\/(?:java|ecma)script/i;ce=E.createDocumentFragment().appendChild(E.createElement("div")),(fe=E.createElement("input")).setAttribute("type","radio"),fe.setAttribute("checked","checked"),fe.setAttribute("name","t"),ce.appendChild(fe),y.checkClone=ce.cloneNode(!0).cloneNode(!0).lastChild.checked,ce.innerHTML="<textarea>x</textarea>",y.noCloneChecked=!!ce.cloneNode(!0).lastChild.defaultValue,ce.innerHTML="<option></option>",y.option=!!ce.lastChild;var ge={thead:[1,"<table>","</table>"],col:[2,"<table><colgroup>","</colgroup></table>"],tr:[2,"<table><tbody>","</tbody></table>"],td:[3,"<table><tbody><tr>","</tr></tbody></table>"],_default:[0,"",""]};function ve(e,t){var n;return n="undefined"!=typeof e.getElementsByTagName?e.getElementsByTagName(t||"*"):"undefined"!=typeof e.querySelectorAll?e.querySelectorAll(t||"*"):[],void 0===t||t&&A(e,t)?S.merge([e],n):n}function ye(e,t){for(var n=0,r=e.length;n<r;n++)Y.set(e[n],"globalEval",!t||Y.get(t[n],"globalEval"))}ge.tbody=ge.tfoot=ge.colgroup=ge.caption=ge.thead,ge.th=ge.td,y.option||(ge.optgroup=ge.option=[1,"<select multiple='multiple'>","</select>"]);var me=/<|&#?\w+;/;function xe(e,t,n,r,i){for(var o,a,s,u,l,c,f=t.createDocumentFragment(),p=[],d=0,h=e.length;d<h;d++)if((o=e[d])||0===o)if("object"===w(o))S.merge(p,o.nodeType?[o]:o);else if(me.test(o)){a=a||f.appendChild(t.createElement("div")),s=(de.exec(o)||["",""])[1].toLowerCase(),u=ge[s]||ge._default,a.innerHTML=u[1]+S.htmlPrefilter(o)+u[2],c=u[0];while(c--)a=a.lastChild;S.merge(p,a.childNodes),(a=f.firstChild).textContent=""}else p.push(t.createTextNode(o));f.textContent="",d=0;while(o=p[d++])if(r&&-1<S.inArray(o,r))i&&i.push(o);else if(l=ie(o),a=ve(f.appendChild(o),"script"),l&&ye(a),n){c=0;while(o=a[c++])he.test(o.type||"")&&n.push(o)}return f}var be=/^key/,we=/^(?:mouse|pointer|contextmenu|drag|drop)|click/,Te=/^([^.]*)(?:\.(.+)|)/;function Ce(){return!0}function Ee(){return!1}function Se(e,t){return e===function(){try{return E.activeElement}catch(e){}}()==("focus"===t)}function ke(e,t,n,r,i,o){var a,s;if("object"==typeof t){for(s in"string"!=typeof n&&(r=r||n,n=void 0),t)ke(e,s,n,r,t[s],o);return e}if(null==r&&null==i?(i=n,r=n=void 0):null==i&&("string"==typeof n?(i=r,r=void 0):(i=r,r=n,n=void 0)),!1===i)i=Ee;else if(!i)return e;return 1===o&&(a=i,(i=function(e){return S().off(e),a.apply(this,arguments)}).guid=a.guid||(a.guid=S.guid++)),e.each(function(){S.event.add(this,t,i,r,n)})}function Ae(e,i,o){o?(Y.set(e,i,!1),S.event.add(e,i,{namespace:!1,handler:function(e){var t,n,r=Y.get(this,i);if(1&e.isTrigger&&this[i]){if(r.length)(S.event.special[i]||{}).delegateType&&e.stopPropagation();else if(r=s.call(arguments),Y.set(this,i,r),t=o(this,i),this[i](),r!==(n=Y.get(this,i))||t?Y.set(this,i,!1):n={},r!==n)return e.stopImmediatePropagation(),e.preventDefault(),n.value}else r.length&&(Y.set(this,i,{value:S.event.trigger(S.extend(r[0],S.Event.prototype),r.slice(1),this)}),e.stopImmediatePropagation())}})):void 0===Y.get(e,i)&&S.event.add(e,i,Ce)}S.event={global:{},add:function(t,e,n,r,i){var o,a,s,u,l,c,f,p,d,h,g,v=Y.get(t);if(V(t)){n.handler&&(n=(o=n).handler,i=o.selector),i&&S.find.matchesSelector(re,i),n.guid||(n.guid=S.guid++),(u=v.events)||(u=v.events=Object.create(null)),(a=v.handle)||(a=v.handle=function(e){return"undefined"!=typeof S&&S.event.triggered!==e.type?S.event.dispatch.apply(t,arguments):void 0}),l=(e=(e||"").match(P)||[""]).length;while(l--)d=g=(s=Te.exec(e[l])||[])[1],h=(s[2]||"").split(".").sort(),d&&(f=S.event.special[d]||{},d=(i?f.delegateType:f.bindType)||d,f=S.event.special[d]||{},c=S.extend({type:d,origType:g,data:r,handler:n,guid:n.guid,selector:i,needsContext:i&&S.expr.match.needsContext.test(i),namespace:h.join(".")},o),(p=u[d])||((p=u[d]=[]).delegateCount=0,f.setup&&!1!==f.setup.call(t,r,h,a)||t.addEventListener&&t.addEventListener(d,a)),f.add&&(f.add.call(t,c),c.handler.guid||(c.handler.guid=n.guid)),i?p.splice(p.delegateCount++,0,c):p.push(c),S.event.global[d]=!0)}},remove:function(e,t,n,r,i){var o,a,s,u,l,c,f,p,d,h,g,v=Y.hasData(e)&&Y.get(e);if(v&&(u=v.events)){l=(t=(t||"").match(P)||[""]).length;while(l--)if(d=g=(s=Te.exec(t[l])||[])[1],h=(s[2]||"").split(".").sort(),d){f=S.event.special[d]||{},p=u[d=(r?f.delegateType:f.bindType)||d]||[],s=s[2]&&new RegExp("(^|\\.)"+h.join("\\.(?:.*\\.|)")+"(\\.|$)"),a=o=p.length;while(o--)c=p[o],!i&&g!==c.origType||n&&n.guid!==c.guid||s&&!s.test(c.namespace)||r&&r!==c.selector&&("**"!==r||!c.selector)||(p.splice(o,1),c.selector&&p.delegateCount--,f.remove&&f.remove.call(e,c));a&&!p.length&&(f.teardown&&!1!==f.teardown.call(e,h,v.handle)||S.removeEvent(e,d,v.handle),delete u[d])}else for(d in u)S.event.remove(e,d+t[l],n,r,!0);S.isEmptyObject(u)&&Y.remove(e,"handle events")}},dispatch:function(e){var t,n,r,i,o,a,s=new Array(arguments.length),u=S.event.fix(e),l=(Y.get(this,"events")||Object.create(null))[u.type]||[],c=S.event.special[u.type]||{};for(s[0]=u,t=1;t<arguments.length;t++)s[t]=arguments[t];if(u.delegateTarget=this,!c.preDispatch||!1!==c.preDispatch.call(this,u)){a=S.event.handlers.call(this,u,l),t=0;while((i=a[t++])&&!u.isPropagationStopped()){u.currentTarget=i.elem,n=0;while((o=i.handlers[n++])&&!u.isImmediatePropagationStopped())u.rnamespace&&!1!==o.namespace&&!u.rnamespace.test(o.namespace)||(u.handleObj=o,u.data=o.data,void 0!==(r=((S.event.special[o.origType]||{}).handle||o.handler).apply(i.elem,s))&&!1===(u.result=r)&&(u.preventDefault(),u.stopPropagation()))}return c.postDispatch&&c.postDispatch.call(this,u),u.result}},handlers:function(e,t){var n,r,i,o,a,s=[],u=t.delegateCount,l=e.target;if(u&&l.nodeType&&!("click"===e.type&&1<=e.button))for(;l!==this;l=l.parentNode||this)if(1===l.nodeType&&("click"!==e.type||!0!==l.disabled)){for(o=[],a={},n=0;n<u;n++)void 0===a[i=(r=t[n]).selector+" "]&&(a[i]=r.needsContext?-1<S(i,this).index(l):S.find(i,this,null,[l]).length),a[i]&&o.push(r);o.length&&s.push({elem:l,handlers:o})}return l=this,u<t.length&&s.push({elem:l,handlers:t.slice(u)}),s},addProp:function(t,e){Object.defineProperty(S.Event.prototype,t,{enumerable:!0,configurable:!0,get:m(e)?function(){if(this.originalEvent)return e(this.originalEvent)}:function(){if(this.originalEvent)return this.originalEvent[t]},set:function(e){Object.defineProperty(this,t,{enumerable:!0,configurable:!0,writable:!0,value:e})}})},fix:function(e){return e[S.expando]?e:new S.Event(e)},special:{load:{noBubble:!0},click:{setup:function(e){var t=this||e;return pe.test(t.type)&&t.click&&A(t,"input")&&Ae(t,"click",Ce),!1},trigger:function(e){var t=this||e;return pe.test(t.type)&&t.click&&A(t,"input")&&Ae(t,"click"),!0},_default:function(e){var t=e.target;return pe.test(t.type)&&t.click&&A(t,"input")&&Y.get(t,"click")||A(t,"a")}},beforeunload:{postDispatch:function(e){void 0!==e.result&&e.originalEvent&&(e.originalEvent.returnValue=e.result)}}}},S.removeEvent=function(e,t,n){e.removeEventListener&&e.removeEventListener(t,n)},S.Event=function(e,t){if(!(this instanceof S.Event))return new S.Event(e,t);e&&e.type?(this.originalEvent=e,this.type=e.type,this.isDefaultPrevented=e.defaultPrevented||void 0===e.defaultPrevented&&!1===e.returnValue?Ce:Ee,this.target=e.target&&3===e.target.nodeType?e.target.parentNode:e.target,this.currentTarget=e.currentTarget,this.relatedTarget=e.relatedTarget):this.type=e,t&&S.extend(this,t),this.timeStamp=e&&e.timeStamp||Date.now(),this[S.expando]=!0},S.Event.prototype={constructor:S.Event,isDefaultPrevented:Ee,isPropagationStopped:Ee,isImmediatePropagationStopped:Ee,isSimulated:!1,preventDefault:function(){var e=this.originalEvent;this.isDefaultPrevented=Ce,e&&!this.isSimulated&&e.preventDefault()},stopPropagation:function(){var e=this.originalEvent;this.isPropagationStopped=Ce,e&&!this.isSimulated&&e.stopPropagation()},stopImmediatePropagation:function(){var e=this.originalEvent;this.isImmediatePropagationStopped=Ce,e&&!this.isSimulated&&e.stopImmediatePropagation(),this.stopPropagation()}},S.each({altKey:!0,bubbles:!0,cancelable:!0,changedTouches:!0,ctrlKey:!0,detail:!0,eventPhase:!0,metaKey:!0,pageX:!0,pageY:!0,shiftKey:!0,view:!0,"char":!0,code:!0,charCode:!0,key:!0,keyCode:!0,button:!0,buttons:!0,clientX:!0,clientY:!0,offsetX:!0,offsetY:!0,pointerId:!0,pointerType:!0,screenX:!0,screenY:!0,targetTouches:!0,toElement:!0,touches:!0,which:function(e){var t=e.button;return null==e.which&&be.test(e.type)?null!=e.charCode?e.charCode:e.keyCode:!e.which&&void 0!==t&&we.test(e.type)?1&t?1:2&t?3:4&t?2:0:e.which}},S.event.addProp),S.each({focus:"focusin",blur:"focusout"},function(e,t){S.event.special[e]={setup:function(){return Ae(this,e,Se),!1},trigger:function(){return Ae(this,e),!0},delegateType:t}}),S.each({mouseenter:"mouseover",mouseleave:"mouseout",pointerenter:"pointerover",pointerleave:"pointerout"},function(e,i){S.event.special[e]={delegateType:i,bindType:i,handle:function(e){var t,n=e.relatedTarget,r=e.handleObj;return n&&(n===this||S.contains(this,n))||(e.type=r.origType,t=r.handler.apply(this,arguments),e.type=i),t}}}),S.fn.extend({on:function(e,t,n,r){return ke(this,e,t,n,r)},one:function(e,t,n,r){return ke(this,e,t,n,r,1)},off:function(e,t,n){var r,i;if(e&&e.preventDefault&&e.handleObj)return r=e.handleObj,S(e.delegateTarget).off(r.namespace?r.origType+"."+r.namespace:r.origType,r.selector,r.handler),this;if("object"==typeof e){for(i in e)this.off(i,t,e[i]);return this}return!1!==t&&"function"!=typeof t||(n=t,t=void 0),!1===n&&(n=Ee),this.each(function(){S.event.remove(this,e,n,t)})}});var Ne=/<script|<style|<link/i,De=/checked\s*(?:[^=]|=\s*.checked.)/i,je=/^\s*<!(?:\[CDATA\[|--)|(?:\]\]|--)>\s*$/g;function qe(e,t){return A(e,"table")&&A(11!==t.nodeType?t:t.firstChild,"tr")&&S(e).children("tbody")[0]||e}function Le(e){return e.type=(null!==e.getAttribute("type"))+"/"+e.type,e}function He(e){return"true/"===(e.type||"").slice(0,5)?e.type=e.type.slice(5):e.removeAttribute("type"),e}function Oe(e,t){var n,r,i,o,a,s;if(1===t.nodeType){if(Y.hasData(e)&&(s=Y.get(e).events))for(i in Y.remove(t,"handle events"),s)for(n=0,r=s[i].length;n<r;n++)S.event.add(t,i,s[i][n]);Q.hasData(e)&&(o=Q.access(e),a=S.extend({},o),Q.set(t,a))}}function Pe(n,r,i,o){r=g(r);var e,t,a,s,u,l,c=0,f=n.length,p=f-1,d=r[0],h=m(d);if(h||1<f&&"string"==typeof d&&!y.checkClone&&De.test(d))return n.each(function(e){var t=n.eq(e);h&&(r[0]=d.call(this,e,t.html())),Pe(t,r,i,o)});if(f&&(t=(e=xe(r,n[0].ownerDocument,!1,n,o)).firstChild,1===e.childNodes.length&&(e=t),t||o)){for(s=(a=S.map(ve(e,"script"),Le)).length;c<f;c++)u=e,c!==p&&(u=S.clone(u,!0,!0),s&&S.merge(a,ve(u,"script"))),i.call(n[c],u,c);if(s)for(l=a[a.length-1].ownerDocument,S.map(a,He),c=0;c<s;c++)u=a[c],he.test(u.type||"")&&!Y.access(u,"globalEval")&&S.contains(l,u)&&(u.src&&"module"!==(u.type||"").toLowerCase()?S._evalUrl&&!u.noModule&&S._evalUrl(u.src,{nonce:u.nonce||u.getAttribute("nonce")},l):b(u.textContent.replace(je,""),u,l))}return n}function Re(e,t,n){for(var r,i=t?S.filter(t,e):e,o=0;null!=(r=i[o]);o++)n||1!==r.nodeType||S.cleanData(ve(r)),r.parentNode&&(n&&ie(r)&&ye(ve(r,"script")),r.parentNode.removeChild(r));return e}S.extend({htmlPrefilter:function(e){return e},clone:function(e,t,n){var r,i,o,a,s,u,l,c=e.cloneNode(!0),f=ie(e);if(!(y.noCloneChecked||1!==e.nodeType&&11!==e.nodeType||S.isXMLDoc(e)))for(a=ve(c),r=0,i=(o=ve(e)).length;r<i;r++)s=o[r],u=a[r],void 0,"input"===(l=u.nodeName.toLowerCase())&&pe.test(s.type)?u.checked=s.checked:"input"!==l&&"textarea"!==l||(u.defaultValue=s.defaultValue);if(t)if(n)for(o=o||ve(e),a=a||ve(c),r=0,i=o.length;r<i;r++)Oe(o[r],a[r]);else Oe(e,c);return 0<(a=ve(c,"script")).length&&ye(a,!f&&ve(e,"script")),c},cleanData:function(e){for(var t,n,r,i=S.event.special,o=0;void 0!==(n=e[o]);o++)if(V(n)){if(t=n[Y.expando]){if(t.events)for(r in t.events)i[r]?S.event.remove(n,r):S.removeEvent(n,r,t.handle);n[Y.expando]=void 0}n[Q.expando]&&(n[Q.expando]=void 0)}}}),S.fn.extend({detach:function(e){return Re(this,e,!0)},remove:function(e){return Re(this,e)},text:function(e){return $(this,function(e){return void 0===e?S.text(this):this.empty().each(function(){1!==this.nodeType&&11!==this.nodeType&&9!==this.nodeType||(this.textContent=e)})},null,e,arguments.length)},append:function(){return Pe(this,arguments,function(e){1!==this.nodeType&&11!==this.nodeType&&9!==this.nodeType||qe(this,e).appendChild(e)})},prepend:function(){return Pe(this,arguments,function(e){if(1===this.nodeType||11===this.nodeType||9===this.nodeType){var t=qe(this,e);t.insertBefore(e,t.firstChild)}})},before:function(){return Pe(this,arguments,function(e){this.parentNode&&this.parentNode.insertBefore(e,this)})},after:function(){return Pe(this,arguments,function(e){this.parentNode&&this.parentNode.insertBefore(e,this.nextSibling)})},empty:function(){for(var e,t=0;null!=(e=this[t]);t++)1===e.nodeType&&(S.cleanData(ve(e,!1)),e.textContent="");return this},clone:function(e,t){return e=null!=e&&e,t=null==t?e:t,this.map(function(){return S.clone(this,e,t)})},html:function(e){return $(this,function(e){var t=this[0]||{},n=0,r=this.length;if(void 0===e&&1===t.nodeType)return t.innerHTML;if("string"==typeof e&&!Ne.test(e)&&!ge[(de.exec(e)||["",""])[1].toLowerCase()]){e=S.htmlPrefilter(e);try{for(;n<r;n++)1===(t=this[n]||{}).nodeType&&(S.cleanData(ve(t,!1)),t.innerHTML=e);t=0}catch(e){}}t&&this.empty().append(e)},null,e,arguments.length)},replaceWith:function(){var n=[];return Pe(this,arguments,function(e){var t=this.parentNode;S.inArray(this,n)<0&&(S.cleanData(ve(this)),t&&t.replaceChild(e,this))},n)}}),S.each({appendTo:"append",prependTo:"prepend",insertBefore:"before",insertAfter:"after",replaceAll:"replaceWith"},function(e,a){S.fn[e]=function(e){for(var t,n=[],r=S(e),i=r.length-1,o=0;o<=i;o++)t=o===i?this:this.clone(!0),S(r[o])[a](t),u.apply(n,t.get());return this.pushStack(n)}});var Me=new RegExp("^("+ee+")(?!px)[a-z%]+$","i"),Ie=function(e){var t=e.ownerDocument.defaultView;return t&&t.opener||(t=C),t.getComputedStyle(e)},We=function(e,t,n){var r,i,o={};for(i in t)o[i]=e.style[i],e.style[i]=t[i];for(i in r=n.call(e),t)e.style[i]=o[i];return r},Fe=new RegExp(ne.join("|"),"i");function Be(e,t,n){var r,i,o,a,s=e.style;return(n=n||Ie(e))&&(""!==(a=n.getPropertyValue(t)||n[t])||ie(e)||(a=S.style(e,t)),!y.pixelBoxStyles()&&Me.test(a)&&Fe.test(t)&&(r=s.width,i=s.minWidth,o=s.maxWidth,s.minWidth=s.maxWidth=s.width=a,a=n.width,s.width=r,s.minWidth=i,s.maxWidth=o)),void 0!==a?a+"":a}function $e(e,t){return{get:function(){if(!e())return(this.get=t).apply(this,arguments);delete this.get}}}!function(){function e(){if(l){u.style.cssText="position:absolute;left:-11111px;width:60px;margin-top:1px;padding:0;border:0",l.style.cssText="position:relative;display:block;box-sizing:border-box;overflow:scroll;margin:auto;border:1px;padding:1px;width:60%;top:1%",re.appendChild(u).appendChild(l);var e=C.getComputedStyle(l);n="1%"!==e.top,s=12===t(e.marginLeft),l.style.right="60%",o=36===t(e.right),r=36===t(e.width),l.style.position="absolute",i=12===t(l.offsetWidth/3),re.removeChild(u),l=null}}function t(e){return Math.round(parseFloat(e))}var n,r,i,o,a,s,u=E.createElement("div"),l=E.createElement("div");l.style&&(l.style.backgroundClip="content-box",l.cloneNode(!0).style.backgroundClip="",y.clearCloneStyle="content-box"===l.style.backgroundClip,S.extend(y,{boxSizingReliable:function(){return e(),r},pixelBoxStyles:function(){return e(),o},pixelPosition:function(){return e(),n},reliableMarginLeft:function(){return e(),s},scrollboxSize:function(){return e(),i},reliableTrDimensions:function(){var e,t,n,r;return null==a&&(e=E.createElement("table"),t=E.createElement("tr"),n=E.createElement("div"),e.style.cssText="position:absolute;left:-11111px",t.style.height="1px",n.style.height="9px",re.appendChild(e).appendChild(t).appendChild(n),r=C.getComputedStyle(t),a=3<parseInt(r.height),re.removeChild(e)),a}}))}();var _e=["Webkit","Moz","ms"],ze=E.createElement("div").style,Ue={};function Xe(e){var t=S.cssProps[e]||Ue[e];return t||(e in ze?e:Ue[e]=function(e){var t=e[0].toUpperCase()+e.slice(1),n=_e.length;while(n--)if((e=_e[n]+t)in ze)return e}(e)||e)}var Ve=/^(none|table(?!-c[ea]).+)/,Ge=/^--/,Ye={position:"absolute",visibility:"hidden",display:"block"},Qe={letterSpacing:"0",fontWeight:"400"};function Je(e,t,n){var r=te.exec(t);return r?Math.max(0,r[2]-(n||0))+(r[3]||"px"):t}function Ke(e,t,n,r,i,o){var a="width"===t?1:0,s=0,u=0;if(n===(r?"border":"content"))return 0;for(;a<4;a+=2)"margin"===n&&(u+=S.css(e,n+ne[a],!0,i)),r?("content"===n&&(u-=S.css(e,"padding"+ne[a],!0,i)),"margin"!==n&&(u-=S.css(e,"border"+ne[a]+"Width",!0,i))):(u+=S.css(e,"padding"+ne[a],!0,i),"padding"!==n?u+=S.css(e,"border"+ne[a]+"Width",!0,i):s+=S.css(e,"border"+ne[a]+"Width",!0,i));return!r&&0<=o&&(u+=Math.max(0,Math.ceil(e["offset"+t[0].toUpperCase()+t.slice(1)]-o-u-s-.5))||0),u}function Ze(e,t,n){var r=Ie(e),i=(!y.boxSizingReliable()||n)&&"border-box"===S.css(e,"boxSizing",!1,r),o=i,a=Be(e,t,r),s="offset"+t[0].toUpperCase()+t.slice(1);if(Me.test(a)){if(!n)return a;a="auto"}return(!y.boxSizingReliable()&&i||!y.reliableTrDimensions()&&A(e,"tr")||"auto"===a||!parseFloat(a)&&"inline"===S.css(e,"display",!1,r))&&e.getClientRects().length&&(i="border-box"===S.css(e,"boxSizing",!1,r),(o=s in e)&&(a=e[s])),(a=parseFloat(a)||0)+Ke(e,t,n||(i?"border":"content"),o,r,a)+"px"}function et(e,t,n,r,i){return new et.prototype.init(e,t,n,r,i)}S.extend({cssHooks:{opacity:{get:function(e,t){if(t){var n=Be(e,"opacity");return""===n?"1":n}}}},cssNumber:{animationIterationCount:!0,columnCount:!0,fillOpacity:!0,flexGrow:!0,flexShrink:!0,fontWeight:!0,gridArea:!0,gridColumn:!0,gridColumnEnd:!0,gridColumnStart:!0,gridRow:!0,gridRowEnd:!0,gridRowStart:!0,lineHeight:!0,opacity:!0,order:!0,orphans:!0,widows:!0,zIndex:!0,zoom:!0},cssProps:{},style:function(e,t,n,r){if(e&&3!==e.nodeType&&8!==e.nodeType&&e.style){var i,o,a,s=X(t),u=Ge.test(t),l=e.style;if(u||(t=Xe(s)),a=S.cssHooks[t]||S.cssHooks[s],void 0===n)return a&&"get"in a&&void 0!==(i=a.get(e,!1,r))?i:l[t];"string"===(o=typeof n)&&(i=te.exec(n))&&i[1]&&(n=se(e,t,i),o="number"),null!=n&&n==n&&("number"!==o||u||(n+=i&&i[3]||(S.cssNumber[s]?"":"px")),y.clearCloneStyle||""!==n||0!==t.indexOf("background")||(l[t]="inherit"),a&&"set"in a&&void 0===(n=a.set(e,n,r))||(u?l.setProperty(t,n):l[t]=n))}},css:function(e,t,n,r){var i,o,a,s=X(t);return Ge.test(t)||(t=Xe(s)),(a=S.cssHooks[t]||S.cssHooks[s])&&"get"in a&&(i=a.get(e,!0,n)),void 0===i&&(i=Be(e,t,r)),"normal"===i&&t in Qe&&(i=Qe[t]),""===n||n?(o=parseFloat(i),!0===n||isFinite(o)?o||0:i):i}}),S.each(["height","width"],function(e,u){S.cssHooks[u]={get:function(e,t,n){if(t)return!Ve.test(S.css(e,"display"))||e.getClientRects().length&&e.getBoundingClientRect().width?Ze(e,u,n):We(e,Ye,function(){return Ze(e,u,n)})},set:function(e,t,n){var r,i=Ie(e),o=!y.scrollboxSize()&&"absolute"===i.position,a=(o||n)&&"border-box"===S.css(e,"boxSizing",!1,i),s=n?Ke(e,u,n,a,i):0;return a&&o&&(s-=Math.ceil(e["offset"+u[0].toUpperCase()+u.slice(1)]-parseFloat(i[u])-Ke(e,u,"border",!1,i)-.5)),s&&(r=te.exec(t))&&"px"!==(r[3]||"px")&&(e.style[u]=t,t=S.css(e,u)),Je(0,t,s)}}}),S.cssHooks.marginLeft=$e(y.reliableMarginLeft,function(e,t){if(t)return(parseFloat(Be(e,"marginLeft"))||e.getBoundingClientRect().left-We(e,{marginLeft:0},function(){return e.getBoundingClientRect().left}))+"px"}),S.each({margin:"",padding:"",border:"Width"},function(i,o){S.cssHooks[i+o]={expand:function(e){for(var t=0,n={},r="string"==typeof e?e.split(" "):[e];t<4;t++)n[i+ne[t]+o]=r[t]||r[t-2]||r[0];return n}},"margin"!==i&&(S.cssHooks[i+o].set=Je)}),S.fn.extend({css:function(e,t){return $(this,function(e,t,n){var r,i,o={},a=0;if(Array.isArray(t)){for(r=Ie(e),i=t.length;a<i;a++)o[t[a]]=S.css(e,t[a],!1,r);return o}return void 0!==n?S.style(e,t,n):S.css(e,t)},e,t,1<arguments.length)}}),((S.Tween=et).prototype={constructor:et,init:function(e,t,n,r,i,o){this.elem=e,this.prop=n,this.easing=i||S.easing._default,this.options=t,this.start=this.now=this.cur(),this.end=r,this.unit=o||(S.cssNumber[n]?"":"px")},cur:function(){var e=et.propHooks[this.prop];return e&&e.get?e.get(this):et.propHooks._default.get(this)},run:function(e){var t,n=et.propHooks[this.prop];return this.options.duration?this.pos=t=S.easing[this.easing](e,this.options.duration*e,0,1,this.options.duration):this.pos=t=e,this.now=(this.end-this.start)*t+this.start,this.options.step&&this.options.step.call(this.elem,this.now,this),n&&n.set?n.set(this):et.propHooks._default.set(this),this}}).init.prototype=et.prototype,(et.propHooks={_default:{get:function(e){var t;return 1!==e.elem.nodeType||null!=e.elem[e.prop]&&null==e.elem.style[e.prop]?e.elem[e.prop]:(t=S.css(e.elem,e.prop,""))&&"auto"!==t?t:0},set:function(e){S.fx.step[e.prop]?S.fx.step[e.prop](e):1!==e.elem.nodeType||!S.cssHooks[e.prop]&&null==e.elem.style[Xe(e.prop)]?e.elem[e.prop]=e.now:S.style(e.elem,e.prop,e.now+e.unit)}}}).scrollTop=et.propHooks.scrollLeft={set:function(e){e.elem.nodeType&&e.elem.parentNode&&(e.elem[e.prop]=e.now)}},S.easing={linear:function(e){return e},swing:function(e){return.5-Math.cos(e*Math.PI)/2},_default:"swing"},S.fx=et.prototype.init,S.fx.step={};var tt,nt,rt,it,ot=/^(?:toggle|show|hide)$/,at=/queueHooks$/;function st(){nt&&(!1===E.hidden&&C.requestAnimationFrame?C.requestAnimationFrame(st):C.setTimeout(st,S.fx.interval),S.fx.tick())}function ut(){return C.setTimeout(function(){tt=void 0}),tt=Date.now()}function lt(e,t){var n,r=0,i={height:e};for(t=t?1:0;r<4;r+=2-t)i["margin"+(n=ne[r])]=i["padding"+n]=e;return t&&(i.opacity=i.width=e),i}function ct(e,t,n){for(var r,i=(ft.tweeners[t]||[]).concat(ft.tweeners["*"]),o=0,a=i.length;o<a;o++)if(r=i[o].call(n,t,e))return r}function ft(o,e,t){var n,a,r=0,i=ft.prefilters.length,s=S.Deferred().always(function(){delete u.elem}),u=function(){if(a)return!1;for(var e=tt||ut(),t=Math.max(0,l.startTime+l.duration-e),n=1-(t/l.duration||0),r=0,i=l.tweens.length;r<i;r++)l.tweens[r].run(n);return s.notifyWith(o,[l,n,t]),n<1&&i?t:(i||s.notifyWith(o,[l,1,0]),s.resolveWith(o,[l]),!1)},l=s.promise({elem:o,props:S.extend({},e),opts:S.extend(!0,{specialEasing:{},easing:S.easing._default},t),originalProperties:e,originalOptions:t,startTime:tt||ut(),duration:t.duration,tweens:[],createTween:function(e,t){var n=S.Tween(o,l.opts,e,t,l.opts.specialEasing[e]||l.opts.easing);return l.tweens.push(n),n},stop:function(e){var t=0,n=e?l.tweens.length:0;if(a)return this;for(a=!0;t<n;t++)l.tweens[t].run(1);return e?(s.notifyWith(o,[l,1,0]),s.resolveWith(o,[l,e])):s.rejectWith(o,[l,e]),this}}),c=l.props;for(!function(e,t){var n,r,i,o,a;for(n in e)if(i=t[r=X(n)],o=e[n],Array.isArray(o)&&(i=o[1],o=e[n]=o[0]),n!==r&&(e[r]=o,delete e[n]),(a=S.cssHooks[r])&&"expand"in a)for(n in o=a.expand(o),delete e[r],o)n in e||(e[n]=o[n],t[n]=i);else t[r]=i}(c,l.opts.specialEasing);r<i;r++)if(n=ft.prefilters[r].call(l,o,c,l.opts))return m(n.stop)&&(S._queueHooks(l.elem,l.opts.queue).stop=n.stop.bind(n)),n;return S.map(c,ct,l),m(l.opts.start)&&l.opts.start.call(o,l),l.progress(l.opts.progress).done(l.opts.done,l.opts.complete).fail(l.opts.fail).always(l.opts.always),S.fx.timer(S.extend(u,{elem:o,anim:l,queue:l.opts.queue})),l}S.Animation=S.extend(ft,{tweeners:{"*":[function(e,t){var n=this.createTween(e,t);return se(n.elem,e,te.exec(t),n),n}]},tweener:function(e,t){m(e)?(t=e,e=["*"]):e=e.match(P);for(var n,r=0,i=e.length;r<i;r++)n=e[r],ft.tweeners[n]=ft.tweeners[n]||[],ft.tweeners[n].unshift(t)},prefilters:[function(e,t,n){var r,i,o,a,s,u,l,c,f="width"in t||"height"in t,p=this,d={},h=e.style,g=e.nodeType&&ae(e),v=Y.get(e,"fxshow");for(r in n.queue||(null==(a=S._queueHooks(e,"fx")).unqueued&&(a.unqueued=0,s=a.empty.fire,a.empty.fire=function(){a.unqueued||s()}),a.unqueued++,p.always(function(){p.always(function(){a.unqueued--,S.queue(e,"fx").length||a.empty.fire()})})),t)if(i=t[r],ot.test(i)){if(delete t[r],o=o||"toggle"===i,i===(g?"hide":"show")){if("show"!==i||!v||void 0===v[r])continue;g=!0}d[r]=v&&v[r]||S.style(e,r)}if((u=!S.isEmptyObject(t))||!S.isEmptyObject(d))for(r in f&&1===e.nodeType&&(n.overflow=[h.overflow,h.overflowX,h.overflowY],null==(l=v&&v.display)&&(l=Y.get(e,"display")),"none"===(c=S.css(e,"display"))&&(l?c=l:(le([e],!0),l=e.style.display||l,c=S.css(e,"display"),le([e]))),("inline"===c||"inline-block"===c&&null!=l)&&"none"===S.css(e,"float")&&(u||(p.done(function(){h.display=l}),null==l&&(c=h.display,l="none"===c?"":c)),h.display="inline-block")),n.overflow&&(h.overflow="hidden",p.always(function(){h.overflow=n.overflow[0],h.overflowX=n.overflow[1],h.overflowY=n.overflow[2]})),u=!1,d)u||(v?"hidden"in v&&(g=v.hidden):v=Y.access(e,"fxshow",{display:l}),o&&(v.hidden=!g),g&&le([e],!0),p.done(function(){for(r in g||le([e]),Y.remove(e,"fxshow"),d)S.style(e,r,d[r])})),u=ct(g?v[r]:0,r,p),r in v||(v[r]=u.start,g&&(u.end=u.start,u.start=0))}],prefilter:function(e,t){t?ft.prefilters.unshift(e):ft.prefilters.push(e)}}),S.speed=function(e,t,n){var r=e&&"object"==typeof e?S.extend({},e):{complete:n||!n&&t||m(e)&&e,duration:e,easing:n&&t||t&&!m(t)&&t};return S.fx.off?r.duration=0:"number"!=typeof r.duration&&(r.duration in S.fx.speeds?r.duration=S.fx.speeds[r.duration]:r.duration=S.fx.speeds._default),null!=r.queue&&!0!==r.queue||(r.queue="fx"),r.old=r.complete,r.complete=function(){m(r.old)&&r.old.call(this),r.queue&&S.dequeue(this,r.queue)},r},S.fn.extend({fadeTo:function(e,t,n,r){return this.filter(ae).css("opacity",0).show().end().animate({opacity:t},e,n,r)},animate:function(t,e,n,r){var i=S.isEmptyObject(t),o=S.speed(e,n,r),a=function(){var e=ft(this,S.extend({},t),o);(i||Y.get(this,"finish"))&&e.stop(!0)};return a.finish=a,i||!1===o.queue?this.each(a):this.queue(o.queue,a)},stop:function(i,e,o){var a=function(e){var t=e.stop;delete e.stop,t(o)};return"string"!=typeof i&&(o=e,e=i,i=void 0),e&&this.queue(i||"fx",[]),this.each(function(){var e=!0,t=null!=i&&i+"queueHooks",n=S.timers,r=Y.get(this);if(t)r[t]&&r[t].stop&&a(r[t]);else for(t in r)r[t]&&r[t].stop&&at.test(t)&&a(r[t]);for(t=n.length;t--;)n[t].elem!==this||null!=i&&n[t].queue!==i||(n[t].anim.stop(o),e=!1,n.splice(t,1));!e&&o||S.dequeue(this,i)})},finish:function(a){return!1!==a&&(a=a||"fx"),this.each(function(){var e,t=Y.get(this),n=t[a+"queue"],r=t[a+"queueHooks"],i=S.timers,o=n?n.length:0;for(t.finish=!0,S.queue(this,a,[]),r&&r.stop&&r.stop.call(this,!0),e=i.length;e--;)i[e].elem===this&&i[e].queue===a&&(i[e].anim.stop(!0),i.splice(e,1));for(e=0;e<o;e++)n[e]&&n[e].finish&&n[e].finish.call(this);delete t.finish})}}),S.each(["toggle","show","hide"],function(e,r){var i=S.fn[r];S.fn[r]=function(e,t,n){return null==e||"boolean"==typeof e?i.apply(this,arguments):this.animate(lt(r,!0),e,t,n)}}),S.each({slideDown:lt("show"),slideUp:lt("hide"),slideToggle:lt("toggle"),fadeIn:{opacity:"show"},fadeOut:{opacity:"hide"},fadeToggle:{opacity:"toggle"}},function(e,r){S.fn[e]=function(e,t,n){return this.animate(r,e,t,n)}}),S.timers=[],S.fx.tick=function(){var e,t=0,n=S.timers;for(tt=Date.now();t<n.length;t++)(e=n[t])()||n[t]!==e||n.splice(t--,1);n.length||S.fx.stop(),tt=void 0},S.fx.timer=function(e){S.timers.push(e),S.fx.start()},S.fx.interval=13,S.fx.start=function(){nt||(nt=!0,st())},S.fx.stop=function(){nt=null},S.fx.speeds={slow:600,fast:200,_default:400},S.fn.delay=function(r,e){return r=S.fx&&S.fx.speeds[r]||r,e=e||"fx",this.queue(e,function(e,t){var n=C.setTimeout(e,r);t.stop=function(){C.clearTimeout(n)}})},rt=E.createElement("input"),it=E.createElement("select").appendChild(E.createElement("option")),rt.type="checkbox",y.checkOn=""!==rt.value,y.optSelected=it.selected,(rt=E.createElement("input")).value="t",rt.type="radio",y.radioValue="t"===rt.value;var pt,dt=S.expr.attrHandle;S.fn.extend({attr:function(e,t){return $(this,S.attr,e,t,1<arguments.length)},removeAttr:function(e){return this.each(function(){S.removeAttr(this,e)})}}),S.extend({attr:function(e,t,n){var r,i,o=e.nodeType;if(3!==o&&8!==o&&2!==o)return"undefined"==typeof e.getAttribute?S.prop(e,t,n):(1===o&&S.isXMLDoc(e)||(i=S.attrHooks[t.toLowerCase()]||(S.expr.match.bool.test(t)?pt:void 0)),void 0!==n?null===n?void S.removeAttr(e,t):i&&"set"in i&&void 0!==(r=i.set(e,n,t))?r:(e.setAttribute(t,n+""),n):i&&"get"in i&&null!==(r=i.get(e,t))?r:null==(r=S.find.attr(e,t))?void 0:r)},attrHooks:{type:{set:function(e,t){if(!y.radioValue&&"radio"===t&&A(e,"input")){var n=e.value;return e.setAttribute("type",t),n&&(e.value=n),t}}}},removeAttr:function(e,t){var n,r=0,i=t&&t.match(P);if(i&&1===e.nodeType)while(n=i[r++])e.removeAttribute(n)}}),pt={set:function(e,t,n){return!1===t?S.removeAttr(e,n):e.setAttribute(n,n),n}},S.each(S.expr.match.bool.source.match(/\w+/g),function(e,t){var a=dt[t]||S.find.attr;dt[t]=function(e,t,n){var r,i,o=t.toLowerCase();return n||(i=dt[o],dt[o]=r,r=null!=a(e,t,n)?o:null,dt[o]=i),r}});var ht=/^(?:input|select|textarea|button)$/i,gt=/^(?:a|area)$/i;function vt(e){return(e.match(P)||[]).join(" ")}function yt(e){return e.getAttribute&&e.getAttribute("class")||""}function mt(e){return Array.isArray(e)?e:"string"==typeof e&&e.match(P)||[]}S.fn.extend({prop:function(e,t){return $(this,S.prop,e,t,1<arguments.length)},removeProp:function(e){return this.each(function(){delete this[S.propFix[e]||e]})}}),S.extend({prop:function(e,t,n){var r,i,o=e.nodeType;if(3!==o&&8!==o&&2!==o)return 1===o&&S.isXMLDoc(e)||(t=S.propFix[t]||t,i=S.propHooks[t]),void 0!==n?i&&"set"in i&&void 0!==(r=i.set(e,n,t))?r:e[t]=n:i&&"get"in i&&null!==(r=i.get(e,t))?r:e[t]},propHooks:{tabIndex:{get:function(e){var t=S.find.attr(e,"tabindex");return t?parseInt(t,10):ht.test(e.nodeName)||gt.test(e.nodeName)&&e.href?0:-1}}},propFix:{"for":"htmlFor","class":"className"}}),y.optSelected||(S.propHooks.selected={get:function(e){var t=e.parentNode;return t&&t.parentNode&&t.parentNode.selectedIndex,null},set:function(e){var t=e.parentNode;t&&(t.selectedIndex,t.parentNode&&t.parentNode.selectedIndex)}}),S.each(["tabIndex","readOnly","maxLength","cellSpacing","cellPadding","rowSpan","colSpan","useMap","frameBorder","contentEditable"],function(){S.propFix[this.toLowerCase()]=this}),S.fn.extend({addClass:function(t){var e,n,r,i,o,a,s,u=0;if(m(t))return this.each(function(e){S(this).addClass(t.call(this,e,yt(this)))});if((e=mt(t)).length)while(n=this[u++])if(i=yt(n),r=1===n.nodeType&&" "+vt(i)+" "){a=0;while(o=e[a++])r.indexOf(" "+o+" ")<0&&(r+=o+" ");i!==(s=vt(r))&&n.setAttribute("class",s)}return this},removeClass:function(t){var e,n,r,i,o,a,s,u=0;if(m(t))return this.each(function(e){S(this).removeClass(t.call(this,e,yt(this)))});if(!arguments.length)return this.attr("class","");if((e=mt(t)).length)while(n=this[u++])if(i=yt(n),r=1===n.nodeType&&" "+vt(i)+" "){a=0;while(o=e[a++])while(-1<r.indexOf(" "+o+" "))r=r.replace(" "+o+" "," ");i!==(s=vt(r))&&n.setAttribute("class",s)}return this},toggleClass:function(i,t){var o=typeof i,a="string"===o||Array.isArray(i);return"boolean"==typeof t&&a?t?this.addClass(i):this.removeClass(i):m(i)?this.each(function(e){S(this).toggleClass(i.call(this,e,yt(this),t),t)}):this.each(function(){var e,t,n,r;if(a){t=0,n=S(this),r=mt(i);while(e=r[t++])n.hasClass(e)?n.removeClass(e):n.addClass(e)}else void 0!==i&&"boolean"!==o||((e=yt(this))&&Y.set(this,"__className__",e),this.setAttribute&&this.setAttribute("class",e||!1===i?"":Y.get(this,"__className__")||""))})},hasClass:function(e){var t,n,r=0;t=" "+e+" ";while(n=this[r++])if(1===n.nodeType&&-1<(" "+vt(yt(n))+" ").indexOf(t))return!0;return!1}});var xt=/\r/g;S.fn.extend({val:function(n){var r,e,i,t=this[0];return arguments.length?(i=m(n),this.each(function(e){var t;1===this.nodeType&&(null==(t=i?n.call(this,e,S(this).val()):n)?t="":"number"==typeof t?t+="":Array.isArray(t)&&(t=S.map(t,function(e){return null==e?"":e+""})),(r=S.valHooks[this.type]||S.valHooks[this.nodeName.toLowerCase()])&&"set"in r&&void 0!==r.set(this,t,"value")||(this.value=t))})):t?(r=S.valHooks[t.type]||S.valHooks[t.nodeName.toLowerCase()])&&"get"in r&&void 0!==(e=r.get(t,"value"))?e:"string"==typeof(e=t.value)?e.replace(xt,""):null==e?"":e:void 0}}),S.extend({valHooks:{option:{get:function(e){var t=S.find.attr(e,"value");return null!=t?t:vt(S.text(e))}},select:{get:function(e){var t,n,r,i=e.options,o=e.selectedIndex,a="select-one"===e.type,s=a?null:[],u=a?o+1:i.length;for(r=o<0?u:a?o:0;r<u;r++)if(((n=i[r]).selected||r===o)&&!n.disabled&&(!n.parentNode.disabled||!A(n.parentNode,"optgroup"))){if(t=S(n).val(),a)return t;s.push(t)}return s},set:function(e,t){var n,r,i=e.options,o=S.makeArray(t),a=i.length;while(a--)((r=i[a]).selected=-1<S.inArray(S.valHooks.option.get(r),o))&&(n=!0);return n||(e.selectedIndex=-1),o}}}}),S.each(["radio","checkbox"],function(){S.valHooks[this]={set:function(e,t){if(Array.isArray(t))return e.checked=-1<S.inArray(S(e).val(),t)}},y.checkOn||(S.valHooks[this].get=function(e){return null===e.getAttribute("value")?"on":e.value})}),y.focusin="onfocusin"in C;var bt=/^(?:focusinfocus|focusoutblur)$/,wt=function(e){e.stopPropagation()};S.extend(S.event,{trigger:function(e,t,n,r){var i,o,a,s,u,l,c,f,p=[n||E],d=v.call(e,"type")?e.type:e,h=v.call(e,"namespace")?e.namespace.split("."):[];if(o=f=a=n=n||E,3!==n.nodeType&&8!==n.nodeType&&!bt.test(d+S.event.triggered)&&(-1<d.indexOf(".")&&(d=(h=d.split(".")).shift(),h.sort()),u=d.indexOf(":")<0&&"on"+d,(e=e[S.expando]?e:new S.Event(d,"object"==typeof e&&e)).isTrigger=r?2:3,e.namespace=h.join("."),e.rnamespace=e.namespace?new RegExp("(^|\\.)"+h.join("\\.(?:.*\\.|)")+"(\\.|$)"):null,e.result=void 0,e.target||(e.target=n),t=null==t?[e]:S.makeArray(t,[e]),c=S.event.special[d]||{},r||!c.trigger||!1!==c.trigger.apply(n,t))){if(!r&&!c.noBubble&&!x(n)){for(s=c.delegateType||d,bt.test(s+d)||(o=o.parentNode);o;o=o.parentNode)p.push(o),a=o;a===(n.ownerDocument||E)&&p.push(a.defaultView||a.parentWindow||C)}i=0;while((o=p[i++])&&!e.isPropagationStopped())f=o,e.type=1<i?s:c.bindType||d,(l=(Y.get(o,"events")||Object.create(null))[e.type]&&Y.get(o,"handle"))&&l.apply(o,t),(l=u&&o[u])&&l.apply&&V(o)&&(e.result=l.apply(o,t),!1===e.result&&e.preventDefault());return e.type=d,r||e.isDefaultPrevented()||c._default&&!1!==c._default.apply(p.pop(),t)||!V(n)||u&&m(n[d])&&!x(n)&&((a=n[u])&&(n[u]=null),S.event.triggered=d,e.isPropagationStopped()&&f.addEventListener(d,wt),n[d](),e.isPropagationStopped()&&f.removeEventListener(d,wt),S.event.triggered=void 0,a&&(n[u]=a)),e.result}},simulate:function(e,t,n){var r=S.extend(new S.Event,n,{type:e,isSimulated:!0});S.event.trigger(r,null,t)}}),S.fn.extend({trigger:function(e,t){return this.each(function(){S.event.trigger(e,t,this)})},triggerHandler:function(e,t){var n=this[0];if(n)return S.event.trigger(e,t,n,!0)}}),y.focusin||S.each({focus:"focusin",blur:"focusout"},function(n,r){var i=function(e){S.event.simulate(r,e.target,S.event.fix(e))};S.event.special[r]={setup:function(){var e=this.ownerDocument||this.document||this,t=Y.access(e,r);t||e.addEventListener(n,i,!0),Y.access(e,r,(t||0)+1)},teardown:function(){var e=this.ownerDocument||this.document||this,t=Y.access(e,r)-1;t?Y.access(e,r,t):(e.removeEventListener(n,i,!0),Y.remove(e,r))}}});var Tt=C.location,Ct={guid:Date.now()},Et=/\?/;S.parseXML=function(e){var t;if(!e||"string"!=typeof e)return null;try{t=(new C.DOMParser).parseFromString(e,"text/xml")}catch(e){t=void 0}return t&&!t.getElementsByTagName("parsererror").length||S.error("Invalid XML: "+e),t};var St=/\[\]$/,kt=/\r?\n/g,At=/^(?:submit|button|image|reset|file)$/i,Nt=/^(?:input|select|textarea|keygen)/i;function Dt(n,e,r,i){var t;if(Array.isArray(e))S.each(e,function(e,t){r||St.test(n)?i(n,t):Dt(n+"["+("object"==typeof t&&null!=t?e:"")+"]",t,r,i)});else if(r||"object"!==w(e))i(n,e);else for(t in e)Dt(n+"["+t+"]",e[t],r,i)}S.param=function(e,t){var n,r=[],i=function(e,t){var n=m(t)?t():t;r[r.length]=encodeURIComponent(e)+"="+encodeURIComponent(null==n?"":n)};if(null==e)return"";if(Array.isArray(e)||e.jquery&&!S.isPlainObject(e))S.each(e,function(){i(this.name,this.value)});else for(n in e)Dt(n,e[n],t,i);return r.join("&")},S.fn.extend({serialize:function(){return S.param(this.serializeArray())},serializeArray:function(){return this.map(function(){var e=S.prop(this,"elements");return e?S.makeArray(e):this}).filter(function(){var e=this.type;return this.name&&!S(this).is(":disabled")&&Nt.test(this.nodeName)&&!At.test(e)&&(this.checked||!pe.test(e))}).map(function(e,t){var n=S(this).val();return null==n?null:Array.isArray(n)?S.map(n,function(e){return{name:t.name,value:e.replace(kt,"\r\n")}}):{name:t.name,value:n.replace(kt,"\r\n")}}).get()}});var jt=/%20/g,qt=/#.*$/,Lt=/([?&])_=[^&]*/,Ht=/^(.*?):[ \t]*([^\r\n]*)$/gm,Ot=/^(?:GET|HEAD)$/,Pt=/^\/\//,Rt={},Mt={},It="*/".concat("*"),Wt=E.createElement("a");function Ft(o){return function(e,t){"string"!=typeof e&&(t=e,e="*");var n,r=0,i=e.toLowerCase().match(P)||[];if(m(t))while(n=i[r++])"+"===n[0]?(n=n.slice(1)||"*",(o[n]=o[n]||[]).unshift(t)):(o[n]=o[n]||[]).push(t)}}function Bt(t,i,o,a){var s={},u=t===Mt;function l(e){var r;return s[e]=!0,S.each(t[e]||[],function(e,t){var n=t(i,o,a);return"string"!=typeof n||u||s[n]?u?!(r=n):void 0:(i.dataTypes.unshift(n),l(n),!1)}),r}return l(i.dataTypes[0])||!s["*"]&&l("*")}function $t(e,t){var n,r,i=S.ajaxSettings.flatOptions||{};for(n in t)void 0!==t[n]&&((i[n]?e:r||(r={}))[n]=t[n]);return r&&S.extend(!0,e,r),e}Wt.href=Tt.href,S.extend({active:0,lastModified:{},etag:{},ajaxSettings:{url:Tt.href,type:"GET",isLocal:/^(?:about|app|app-storage|.+-extension|file|res|widget):$/.test(Tt.protocol),global:!0,processData:!0,async:!0,contentType:"application/x-www-form-urlencoded; charset=UTF-8",accepts:{"*":It,text:"text/plain",html:"text/html",xml:"application/xml, text/xml",json:"application/json, text/javascript"},contents:{xml:/\bxml\b/,html:/\bhtml/,json:/\bjson\b/},responseFields:{xml:"responseXML",text:"responseText",json:"responseJSON"},converters:{"* text":String,"text html":!0,"text json":JSON.parse,"text xml":S.parseXML},flatOptions:{url:!0,context:!0}},ajaxSetup:function(e,t){return t?$t($t(e,S.ajaxSettings),t):$t(S.ajaxSettings,e)},ajaxPrefilter:Ft(Rt),ajaxTransport:Ft(Mt),ajax:function(e,t){"object"==typeof e&&(t=e,e=void 0),t=t||{};var c,f,p,n,d,r,h,g,i,o,v=S.ajaxSetup({},t),y=v.context||v,m=v.context&&(y.nodeType||y.jquery)?S(y):S.event,x=S.Deferred(),b=S.Callbacks("once memory"),w=v.statusCode||{},a={},s={},u="canceled",T={readyState:0,getResponseHeader:function(e){var t;if(h){if(!n){n={};while(t=Ht.exec(p))n[t[1].toLowerCase()+" "]=(n[t[1].toLowerCase()+" "]||[]).concat(t[2])}t=n[e.toLowerCase()+" "]}return null==t?null:t.join(", ")},getAllResponseHeaders:function(){return h?p:null},setRequestHeader:function(e,t){return null==h&&(e=s[e.toLowerCase()]=s[e.toLowerCase()]||e,a[e]=t),this},overrideMimeType:function(e){return null==h&&(v.mimeType=e),this},statusCode:function(e){var t;if(e)if(h)T.always(e[T.status]);else for(t in e)w[t]=[w[t],e[t]];return this},abort:function(e){var t=e||u;return c&&c.abort(t),l(0,t),this}};if(x.promise(T),v.url=((e||v.url||Tt.href)+"").replace(Pt,Tt.protocol+"//"),v.type=t.method||t.type||v.method||v.type,v.dataTypes=(v.dataType||"*").toLowerCase().match(P)||[""],null==v.crossDomain){r=E.createElement("a");try{r.href=v.url,r.href=r.href,v.crossDomain=Wt.protocol+"//"+Wt.host!=r.protocol+"//"+r.host}catch(e){v.crossDomain=!0}}if(v.data&&v.processData&&"string"!=typeof v.data&&(v.data=S.param(v.data,v.traditional)),Bt(Rt,v,t,T),h)return T;for(i in(g=S.event&&v.global)&&0==S.active++&&S.event.trigger("ajaxStart"),v.type=v.type.toUpperCase(),v.hasContent=!Ot.test(v.type),f=v.url.replace(qt,""),v.hasContent?v.data&&v.processData&&0===(v.contentType||"").indexOf("application/x-www-form-urlencoded")&&(v.data=v.data.replace(jt,"+")):(o=v.url.slice(f.length),v.data&&(v.processData||"string"==typeof v.data)&&(f+=(Et.test(f)?"&":"?")+v.data,delete v.data),!1===v.cache&&(f=f.replace(Lt,"$1"),o=(Et.test(f)?"&":"?")+"_="+Ct.guid+++o),v.url=f+o),v.ifModified&&(S.lastModified[f]&&T.setRequestHeader("If-Modified-Since",S.lastModified[f]),S.etag[f]&&T.setRequestHeader("If-None-Match",S.etag[f])),(v.data&&v.hasContent&&!1!==v.contentType||t.contentType)&&T.setRequestHeader("Content-Type",v.contentType),T.setRequestHeader("Accept",v.dataTypes[0]&&v.accepts[v.dataTypes[0]]?v.accepts[v.dataTypes[0]]+("*"!==v.dataTypes[0]?", "+It+"; q=0.01":""):v.accepts["*"]),v.headers)T.setRequestHeader(i,v.headers[i]);if(v.beforeSend&&(!1===v.beforeSend.call(y,T,v)||h))return T.abort();if(u="abort",b.add(v.complete),T.done(v.success),T.fail(v.error),c=Bt(Mt,v,t,T)){if(T.readyState=1,g&&m.trigger("ajaxSend",[T,v]),h)return T;v.async&&0<v.timeout&&(d=C.setTimeout(function(){T.abort("timeout")},v.timeout));try{h=!1,c.send(a,l)}catch(e){if(h)throw e;l(-1,e)}}else l(-1,"No Transport");function l(e,t,n,r){var i,o,a,s,u,l=t;h||(h=!0,d&&C.clearTimeout(d),c=void 0,p=r||"",T.readyState=0<e?4:0,i=200<=e&&e<300||304===e,n&&(s=function(e,t,n){var r,i,o,a,s=e.contents,u=e.dataTypes;while("*"===u[0])u.shift(),void 0===r&&(r=e.mimeType||t.getResponseHeader("Content-Type"));if(r)for(i in s)if(s[i]&&s[i].test(r)){u.unshift(i);break}if(u[0]in n)o=u[0];else{for(i in n){if(!u[0]||e.converters[i+" "+u[0]]){o=i;break}a||(a=i)}o=o||a}if(o)return o!==u[0]&&u.unshift(o),n[o]}(v,T,n)),!i&&-1<S.inArray("script",v.dataTypes)&&(v.converters["text script"]=function(){}),s=function(e,t,n,r){var i,o,a,s,u,l={},c=e.dataTypes.slice();if(c[1])for(a in e.converters)l[a.toLowerCase()]=e.converters[a];o=c.shift();while(o)if(e.responseFields[o]&&(n[e.responseFields[o]]=t),!u&&r&&e.dataFilter&&(t=e.dataFilter(t,e.dataType)),u=o,o=c.shift())if("*"===o)o=u;else if("*"!==u&&u!==o){if(!(a=l[u+" "+o]||l["* "+o]))for(i in l)if((s=i.split(" "))[1]===o&&(a=l[u+" "+s[0]]||l["* "+s[0]])){!0===a?a=l[i]:!0!==l[i]&&(o=s[0],c.unshift(s[1]));break}if(!0!==a)if(a&&e["throws"])t=a(t);else try{t=a(t)}catch(e){return{state:"parsererror",error:a?e:"No conversion from "+u+" to "+o}}}return{state:"success",data:t}}(v,s,T,i),i?(v.ifModified&&((u=T.getResponseHeader("Last-Modified"))&&(S.lastModified[f]=u),(u=T.getResponseHeader("etag"))&&(S.etag[f]=u)),204===e||"HEAD"===v.type?l="nocontent":304===e?l="notmodified":(l=s.state,o=s.data,i=!(a=s.error))):(a=l,!e&&l||(l="error",e<0&&(e=0))),T.status=e,T.statusText=(t||l)+"",i?x.resolveWith(y,[o,l,T]):x.rejectWith(y,[T,l,a]),T.statusCode(w),w=void 0,g&&m.trigger(i?"ajaxSuccess":"ajaxError",[T,v,i?o:a]),b.fireWith(y,[T,l]),g&&(m.trigger("ajaxComplete",[T,v]),--S.active||S.event.trigger("ajaxStop")))}return T},getJSON:function(e,t,n){return S.get(e,t,n,"json")},getScript:function(e,t){return S.get(e,void 0,t,"script")}}),S.each(["get","post"],function(e,i){S[i]=function(e,t,n,r){return m(t)&&(r=r||n,n=t,t=void 0),S.ajax(S.extend({url:e,type:i,dataType:r,data:t,success:n},S.isPlainObject(e)&&e))}}),S.ajaxPrefilter(function(e){var t;for(t in e.headers)"content-type"===t.toLowerCase()&&(e.contentType=e.headers[t]||"")}),S._evalUrl=function(e,t,n){return S.ajax({url:e,type:"GET",dataType:"script",cache:!0,async:!1,global:!1,converters:{"text script":function(){}},dataFilter:function(e){S.globalEval(e,t,n)}})},S.fn.extend({wrapAll:function(e){var t;return this[0]&&(m(e)&&(e=e.call(this[0])),t=S(e,this[0].ownerDocument).eq(0).clone(!0),this[0].parentNode&&t.insertBefore(this[0]),t.map(function(){var e=this;while(e.firstElementChild)e=e.firstElementChild;return e}).append(this)),this},wrapInner:function(n){return m(n)?this.each(function(e){S(this).wrapInner(n.call(this,e))}):this.each(function(){var e=S(this),t=e.contents();t.length?t.wrapAll(n):e.append(n)})},wrap:function(t){var n=m(t);return this.each(function(e){S(this).wrapAll(n?t.call(this,e):t)})},unwrap:function(e){return this.parent(e).not("body").each(function(){S(this).replaceWith(this.childNodes)}),this}}),S.expr.pseudos.hidden=function(e){return!S.expr.pseudos.visible(e)},S.expr.pseudos.visible=function(e){return!!(e.offsetWidth||e.offsetHeight||e.getClientRects().length)},S.ajaxSettings.xhr=function(){try{return new C.XMLHttpRequest}catch(e){}};var _t={0:200,1223:204},zt=S.ajaxSettings.xhr();y.cors=!!zt&&"withCredentials"in zt,y.ajax=zt=!!zt,S.ajaxTransport(function(i){var o,a;if(y.cors||zt&&!i.crossDomain)return{send:function(e,t){var n,r=i.xhr();if(r.open(i.type,i.url,i.async,i.username,i.password),i.xhrFields)for(n in i.xhrFields)r[n]=i.xhrFields[n];for(n in i.mimeType&&r.overrideMimeType&&r.overrideMimeType(i.mimeType),i.crossDomain||e["X-Requested-With"]||(e["X-Requested-With"]="XMLHttpRequest"),e)r.setRequestHeader(n,e[n]);o=function(e){return function(){o&&(o=a=r.onload=r.onerror=r.onabort=r.ontimeout=r.onreadystatechange=null,"abort"===e?r.abort():"error"===e?"number"!=typeof r.status?t(0,"error"):t(r.status,r.statusText):t(_t[r.status]||r.status,r.statusText,"text"!==(r.responseType||"text")||"string"!=typeof r.responseText?{binary:r.response}:{text:r.responseText},r.getAllResponseHeaders()))}},r.onload=o(),a=r.onerror=r.ontimeout=o("error"),void 0!==r.onabort?r.onabort=a:r.onreadystatechange=function(){4===r.readyState&&C.setTimeout(function(){o&&a()})},o=o("abort");try{r.send(i.hasContent&&i.data||null)}catch(e){if(o)throw e}},abort:function(){o&&o()}}}),S.ajaxPrefilter(function(e){e.crossDomain&&(e.contents.script=!1)}),S.ajaxSetup({accepts:{script:"text/javascript, application/javascript, application/ecmascript, application/x-ecmascript"},contents:{script:/\b(?:java|ecma)script\b/},converters:{"text script":function(e){return S.globalEval(e),e}}}),S.ajaxPrefilter("script",function(e){void 0===e.cache&&(e.cache=!1),e.crossDomain&&(e.type="GET")}),S.ajaxTransport("script",function(n){var r,i;if(n.crossDomain||n.scriptAttrs)return{send:function(e,t){r=S("<script>").attr(n.scriptAttrs||{}).prop({charset:n.scriptCharset,src:n.url}).on("load error",i=function(e){r.remove(),i=null,e&&t("error"===e.type?404:200,e.type)}),E.head.appendChild(r[0])},abort:function(){i&&i()}}});var Ut,Xt=[],Vt=/(=)\?(?=&|$)|\?\?/;S.ajaxSetup({jsonp:"callback",jsonpCallback:function(){var e=Xt.pop()||S.expando+"_"+Ct.guid++;return this[e]=!0,e}}),S.ajaxPrefilter("json jsonp",function(e,t,n){var r,i,o,a=!1!==e.jsonp&&(Vt.test(e.url)?"url":"string"==typeof e.data&&0===(e.contentType||"").indexOf("application/x-www-form-urlencoded")&&Vt.test(e.data)&&"data");if(a||"jsonp"===e.dataTypes[0])return r=e.jsonpCallback=m(e.jsonpCallback)?e.jsonpCallback():e.jsonpCallback,a?e[a]=e[a].replace(Vt,"$1"+r):!1!==e.jsonp&&(e.url+=(Et.test(e.url)?"&":"?")+e.jsonp+"="+r),e.converters["script json"]=function(){return o||S.error(r+" was not called"),o[0]},e.dataTypes[0]="json",i=C[r],C[r]=function(){o=arguments},n.always(function(){void 0===i?S(C).removeProp(r):C[r]=i,e[r]&&(e.jsonpCallback=t.jsonpCallback,Xt.push(r)),o&&m(i)&&i(o[0]),o=i=void 0}),"script"}),y.createHTMLDocument=((Ut=E.implementation.createHTMLDocument("").body).innerHTML="<form></form><form></form>",2===Ut.childNodes.length),S.parseHTML=function(e,t,n){return"string"!=typeof e?[]:("boolean"==typeof t&&(n=t,t=!1),t||(y.createHTMLDocument?((r=(t=E.implementation.createHTMLDocument("")).createElement("base")).href=E.location.href,t.head.appendChild(r)):t=E),o=!n&&[],(i=N.exec(e))?[t.createElement(i[1])]:(i=xe([e],t,o),o&&o.length&&S(o).remove(),S.merge([],i.childNodes)));var r,i,o},S.fn.load=function(e,t,n){var r,i,o,a=this,s=e.indexOf(" ");return-1<s&&(r=vt(e.slice(s)),e=e.slice(0,s)),m(t)?(n=t,t=void 0):t&&"object"==typeof t&&(i="POST"),0<a.length&&S.ajax({url:e,type:i||"GET",dataType:"html",data:t}).done(function(e){o=arguments,a.html(r?S("<div>").append(S.parseHTML(e)).find(r):e)}).always(n&&function(e,t){a.each(function(){n.apply(this,o||[e.responseText,t,e])})}),this},S.expr.pseudos.animated=function(t){return S.grep(S.timers,function(e){return t===e.elem}).length},S.offset={setOffset:function(e,t,n){var r,i,o,a,s,u,l=S.css(e,"position"),c=S(e),f={};"static"===l&&(e.style.position="relative"),s=c.offset(),o=S.css(e,"top"),u=S.css(e,"left"),("absolute"===l||"fixed"===l)&&-1<(o+u).indexOf("auto")?(a=(r=c.position()).top,i=r.left):(a=parseFloat(o)||0,i=parseFloat(u)||0),m(t)&&(t=t.call(e,n,S.extend({},s))),null!=t.top&&(f.top=t.top-s.top+a),null!=t.left&&(f.left=t.left-s.left+i),"using"in t?t.using.call(e,f):("number"==typeof f.top&&(f.top+="px"),"number"==typeof f.left&&(f.left+="px"),c.css(f))}},S.fn.extend({offset:function(t){if(arguments.length)return void 0===t?this:this.each(function(e){S.offset.setOffset(this,t,e)});var e,n,r=this[0];return r?r.getClientRects().length?(e=r.getBoundingClientRect(),n=r.ownerDocument.defaultView,{top:e.top+n.pageYOffset,left:e.left+n.pageXOffset}):{top:0,left:0}:void 0},position:function(){if(this[0]){var e,t,n,r=this[0],i={top:0,left:0};if("fixed"===S.css(r,"position"))t=r.getBoundingClientRect();else{t=this.offset(),n=r.ownerDocument,e=r.offsetParent||n.documentElement;while(e&&(e===n.body||e===n.documentElement)&&"static"===S.css(e,"position"))e=e.parentNode;e&&e!==r&&1===e.nodeType&&((i=S(e).offset()).top+=S.css(e,"borderTopWidth",!0),i.left+=S.css(e,"borderLeftWidth",!0))}return{top:t.top-i.top-S.css(r,"marginTop",!0),left:t.left-i.left-S.css(r,"marginLeft",!0)}}},offsetParent:function(){return this.map(function(){var e=this.offsetParent;while(e&&"static"===S.css(e,"position"))e=e.offsetParent;return e||re})}}),S.each({scrollLeft:"pageXOffset",scrollTop:"pageYOffset"},function(t,i){var o="pageYOffset"===i;S.fn[t]=function(e){return $(this,function(e,t,n){var r;if(x(e)?r=e:9===e.nodeType&&(r=e.defaultView),void 0===n)return r?r[i]:e[t];r?r.scrollTo(o?r.pageXOffset:n,o?n:r.pageYOffset):e[t]=n},t,e,arguments.length)}}),S.each(["top","left"],function(e,n){S.cssHooks[n]=$e(y.pixelPosition,function(e,t){if(t)return t=Be(e,n),Me.test(t)?S(e).position()[n]+"px":t})}),S.each({Height:"height",Width:"width"},function(a,s){S.each({padding:"inner"+a,content:s,"":"outer"+a},function(r,o){S.fn[o]=function(e,t){var n=arguments.length&&(r||"boolean"!=typeof e),i=r||(!0===e||!0===t?"margin":"border");return $(this,function(e,t,n){var r;return x(e)?0===o.indexOf("outer")?e["inner"+a]:e.document.documentElement["client"+a]:9===e.nodeType?(r=e.documentElement,Math.max(e.body["scroll"+a],r["scroll"+a],e.body["offset"+a],r["offset"+a],r["client"+a])):void 0===n?S.css(e,t,i):S.style(e,t,n,i)},s,n?e:void 0,n)}})}),S.each(["ajaxStart","ajaxStop","ajaxComplete","ajaxError","ajaxSuccess","ajaxSend"],function(e,t){S.fn[t]=function(e){return this.on(t,e)}}),S.fn.extend({bind:function(e,t,n){return this.on(e,null,t,n)},unbind:function(e,t){return this.off(e,null,t)},delegate:function(e,t,n,r){return this.on(t,e,n,r)},undelegate:function(e,t,n){return 1===arguments.length?this.off(e,"**"):this.off(t,e||"**",n)},hover:function(e,t){return this.mouseenter(e).mouseleave(t||e)}}),S.each("blur focus focusin focusout resize scroll click dblclick mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave change select submit keydown keypress keyup contextmenu".split(" "),function(e,n){S.fn[n]=function(e,t){return 0<arguments.length?this.on(n,null,e,t):this.trigger(n)}});var Gt=/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g;S.proxy=function(e,t){var n,r,i;if("string"==typeof t&&(n=e[t],t=e,e=n),m(e))return r=s.call(arguments,2),(i=function(){return e.apply(t||this,r.concat(s.call(arguments)))}).guid=e.guid=e.guid||S.guid++,i},S.holdReady=function(e){e?S.readyWait++:S.ready(!0)},S.isArray=Array.isArray,S.parseJSON=JSON.parse,S.nodeName=A,S.isFunction=m,S.isWindow=x,S.camelCase=X,S.type=w,S.now=Date.now,S.isNumeric=function(e){var t=S.type(e);return("number"===t||"string"===t)&&!isNaN(e-parseFloat(e))},S.trim=function(e){return null==e?"":(e+"").replace(Gt,"")},"function"==typeof define&&define.amd&&define("jquery",[],function(){return S});var Yt=C.jQuery,Qt=C.$;return S.noConflict=function(e){return C.$===S&&(C.$=Qt),e&&C.jQuery===S&&(C.jQuery=Yt),S},"undefined"==typeof e&&(C.jQuery=C.$=S),S});

// Note: include this file when using prototype and jQuery on the same page. Be sure to include prototype.js
// and jquery.js before this file.
// The jQuery $ function will be remapped to $j as to not conflict with the prototype version of that function.

// Be aware that some jQuery plugins may use the $ function and in that case, they should be edited to use $j instead.

(function($) {
  $.noConflict();$j = $;
})(jQuery);

/*
*
* Copyright (c) 2007 Andrew Tetlaw
*
* Permission is hereby granted, free of charge, to any person
* obtaining a copy of this software and associated documentation
* files (the "Software"), to deal in the Software without
* restriction, including without limitation the rights to use, copy,
* modify, merge, publish, distribute, sublicense, and/or sell copies
* of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be
* included in all copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
* EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
* MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
* NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS
* BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
* ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
* CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
* *
*
*
* FastInit
* http://tetlaw.id.au/view/javascript/fastinit
* Andrew Tetlaw
* Version 1.4.1 (2007-03-15)
* Based on:
* http://dean.edwards.name/weblog/2006/03/faster
* http://dean.edwards.name/weblog/2006/06/again/
* Help from:
* http://www.cherny.com/webdev/26/domloaded-object-literal-updated
*
*/
var FastInit = {
  onload : function() {
    if (FastInit.done) { return; }
    FastInit.done = true;
    for(var x = 0, al = FastInit.f.length; x < al; x++) {
      FastInit.f[x]();
    }
    // check for doubleSubmit only if validateForm.js is included in the page and thus nameSpace 'doubleSubmit' is defined
    if(typeof window.doubleSubmit !== "undefined")
    {
      for ( i = 0; i < window.document.forms.length; i++ )
      {
        // In case we end up running fastinit multiple times on a page (i.e. loading a lightbox with a form onto a page with a form), make sure
        // we don't double-check the double-submit.
        if (typeof window.document.forms[i].originalFormSubmit === 'undefined')
        {
          // Below is necessary to make use of both form.onsubmit validations on individual pages
          // and form submit event handlers registered through Event.observe(..."submit"...)
          var originalFormOnSubmit = null;
          if(window.document.forms[i].onsubmit)
          {
            originalFormOnSubmit = window.document.forms[i].onsubmit;
            window.document.forms[i].onsubmit = function() {
              return;
            };
          }
          // Form.submit() doesn't call form submit event handlers registered below, so we have to make
          // sure form submit event handlers get called when form.submit() is used to submit the form
          // Note : Browser does not trigger the onsubmit event if you call the submit method of a form
          // programmatically. Likewise, we don't call form.onsubmit() here and that validation if wanted
          // is up to the developer to do before calling form.submit()
          window.document.forms[i].originalFormSubmit = window.document.forms[i].submit;
          window.document.forms[i].submit = function() {
            if(doubleSubmit.handleFormSubmitEvents( null, this, null ) == false)
            {
              return false;
            }
            return this.originalFormSubmit();
          };
          Event.observe( window.document.forms[i], "submit", doubleSubmit.handleFormSubmitEvents
              .bindAsEventListener( this, window.document.forms[i], originalFormOnSubmit ) );
        }
      }
    }
  },
  addOnLoad : function() {
    var a = arguments;
    for(var x = 0, al = a.length; x < al; x++) {
      if(typeof a[x] === 'function') {
        if (FastInit.done ) {
          a[x]();
        } else {
          FastInit.f.push(a[x]);
        }
      }
    }
  },
  listen : function() {
    if (/WebKit|khtml/i.test(navigator.userAgent)) {
      FastInit.timer = setInterval(function() {
        if (/loaded|complete/.test(document.readyState)) {
          clearInterval(FastInit.timer);
          delete FastInit.timer;
          FastInit.onload();
        }}, 10);
    } else if (document.addEventListener) {
      document.addEventListener('DOMContentLoaded', FastInit.onload, false);
    } else if(!FastInit.iew32) {
      if(window.addEventListener) {
        window.addEventListener('load', FastInit.onload, false);
      } else if (window.attachEvent) {
        return window.attachEvent('onload', FastInit.onload);
      }
    }
  },
  f:[],done:false,timer:null,iew32:false
};
/*@cc_on @*/
/*@if (@_win32)
FastInit.iew32 = true;
document.write('<script id="__ie_onload" defer src="' + ((location.protocol == 'https:') ? '//0' : 'javascript:void(0)') + '"><\/script>');
document.getElementById('__ie_onload').onreadystatechange = function(){if (this.readyState == 'complete') { FastInit.onload(); }};
/*@end @*/
FastInit.listen();
/**
 * Only include the contents of this file once - for example, if this is included in a lightbox we don't want to re-run
 * all of this - just use the loaded version.  (i.e. rerunning would clear page.bundle which would remove all the
 * language strings for the current page)
 */
if (!window.page)
{
var page = {};

page.isLoaded = false;

/**
 * Utility for adding and using localized messages on the page.
 */
page.bundle = {};
page.bundle.messages = {};
page.bundle.addKey = function( key, value )
{
  page.bundle.messages[key] = value;
};

page.bundle.getString = function( key /*, arg1, arg2, ..., argN */ )
{
  var result = page.bundle.messages[key];
  if ( !result )
  {
     return "!!!!" + key + "!!!!!";
  }
  else
  {
    if ( arguments.length > 1 )
    {
      for ( var i = 1; i < arguments.length; i++ )
      {
        result = result.replace( new RegExp("\\{"+(i-1)+"\\}","g"), arguments[i] );
      }
    }
    return result;
  }
};

/**
 * Provides support for lazy initialization of javascript behavior when a certain
 * event happens to a certain item.
 */
page.LazyInit = function( event, eventTypes, initCode )
{
  var e = event || window.event;
  var target = Event.element( event );
  // This is because events bubble and we want a reference
  // to the element we registered the handlers on.
  target = page.util.upToClass(target, "jsInit");
  for (var i = 0; i < eventTypes.length; i++ )
  {
    target['on'+eventTypes[i]] = null;
  }
  eval( initCode ); //initCode can reference "target"
};

/**
 * Evaluates any <script> tags in the provided string in the global scope.
 * Useful for evaluating scripts that come back in text from an Ajax call.
 * If signalObject is passed then signalObject.evaluatingScripts will be set to false when done.
 */
page.globalEvalScripts = function(str, evalExternalScripts, signalObject)
{
  //Get any external scripts
  var waitForVars = [];
  var scriptVars = [
                    { script: 'bb_htmlarea', variable: ['HTMLArea'] },
                    { script: 'w_editor', variable: ['WebeqEditors'] },
                    { script: 'wysiwyg.js', variable: ['vtbe_attchfiles'] },
                    { script: 'gradebook_utils.js', variable: ['gradebook_utils'] },
                    { script: 'rubric.js', variable: ['rubricModule'] },
                    { script: 'gridmgmt.js', variable: ['gridMgmt'] },
                    { script: 'calendar-time.js', variable: ['calendar'] },
                    { script: 'widget.js', variable: ['widget'] },
                    { script: 'vtbeTinymce.js', variable: ['tinyMceWrapper'] },
                    { script: 'WhatsNewView.js', variable: ['WhatsNewView'] },
                    { script: 'tiny_mce.js', variable: ['tinymce','tinyMCE'] },
                    { script: 'slider.js', variable: ['Control.Slider'] },
                    { script: 'drawer.js', variable: ['drawer'] },
                    { script: 'activeFilter.js', variable: ['activeFilter'] },
                    { script: 'inventoryList.js', variable: ['inventoryList'] },
                    { script: 'bbDialogs.js', variable: ['bb_dialogs'] }
                   ];
  if (evalExternalScripts)
  {
    var externalScriptRE = '<script[^>]*src=["\']([^>"\']*)["\'][^>]*>([\\S\\s]*?)<\/script>';
    var scriptMatches = str.match(new RegExp(externalScriptRE, 'img'));
    if (scriptMatches && scriptMatches.length > 0)
    {
      $A(scriptMatches).each(function(scriptTag)
      {
        var matches = scriptTag.match(new RegExp(externalScriptRE, 'im'));
        if (matches && matches.length > 0 && matches[1] != '')
        {
          var scriptSrc = matches[1];
          if (scriptSrc.indexOf('/dwr_open/') != -1)
          {
            // dwr_open calls will ONLY work if the current page's webapp == the caller's webapp,
            // otherwise we'll get a session error.  THis will happen if a lightbox is loaded with
            // dynamic content from a different webapp (say /webapps/blackboard) while the main page
            // is loaded from /webapps/discussionboard.  To avoid this, rewrite the url to use the
            // webapp associated with the current page.
            var newparts = scriptSrc.split('/');
            var oldparts = window.location.pathname.split('/');
            newparts[1] = oldparts[1];
            newparts[2] = oldparts[2];
            scriptSrc = newparts.join('/');
          }
          var scriptElem = new Element('script', {
            async: false,
            type: 'text/javascript',
            src: scriptSrc
          });

          // Note all jquery scripts must be loaded on the main page and they can not relied on dynamically loading
          if (!scriptSrc.match(new RegExp('jquery.*\.js', 'im')))
          {
            var head = $$('head')[0];
            head.appendChild(scriptElem);
            for ( var i = 0; i < scriptVars.length; i++ )
            {
              if ( scriptSrc.indexOf( scriptVars[i].script ) != -1 )
              {
                scriptVars[ i ].variable.each( function( s )
                {
                  waitForVars.push( s );
                } );
                break;
              }
            }
          }
        }
      });
    }
  }
//Finding Comments in HTML Source Code Using Regular Expressions and replaces with empty value
//Example: <!-- <script>alert("welcome");</script>--> = ''
//So,that extractScripts won't find commented scripts to extract
//str =str.replace(new RegExp('\<![ \r\n\t]*(--([^\-]|[\r\n]|-[^\-])*--[ \r\n\t]*)\>', 'img'), '');
  page.delayAddExtractedScripts(str.extractScripts(), waitForVars, signalObject);
};

// Evaluate any inline script - delay a bit to give the scripts above time to load
// NOTE that this is not guaranteed to work - if there are delays loading and initializing
// the scripts required then code in these scripts might fail to find the required variables
// If it is for our code then updating waitForVars appropriately per script will work
page.delayAddExtractedScripts = function (scripts, waitForVars, signalObject)
{
  var count = 0;
  if (waitForVars.length === 0)
  {
    page.actuallyAddExtractedScripts(scripts, signalObject);
  }
  else
  {
  new PeriodicalExecuter( function( pe )
  {
    if ( count < 100 )
    {
      count++;
      if ( page.allVariablesDefined(waitForVars) )
      {
        page.actuallyAddExtractedScripts(scripts, signalObject);
        pe.stop();
      }
    }
    else // give up if it takes longer than 5s to load
    {
      page.actuallyAddExtractedScripts(scripts, signalObject);
      pe.stop();
    }
  }.bind(this), 0.05 );
  }
};

page.variableDefined = function (avar)
{

  if ( !window[avar] )
  {
    if (avar.indexOf('.') > 0)
    {
      var parts = avar.split('.');
      var obj = window[parts[0]];
      for (var partNum = 1; obj && partNum < parts.length; partNum++)
      {
        obj = obj[parts[partNum]];
      }
      if (obj)
      {
        return true;
      }
    }
    return false;
  }
  return true;
};
page.allVariablesDefined = function(vars)
{
  var result = true;
  for ( var i = 0; i < vars.length; i++ )
  {
    if ( !page.variableDefined(vars[i]) )
    {
      result = false;
      break;
    }
  }
  return result;
};

page.actuallyAddExtractedScripts = function (scripts, signalObject)
{
  var scriptExecutionDelay = 0;
  if( signalObject )
  {
    scriptExecutionDelay = signalObject.delayScriptExecution;
    if (scriptExecutionDelay === undefined)
    {
      scriptExecutionDelay = 0;
    }
  }
  if (FastInit !== undefined && typeof(FastInit.onload) === "function")
  {
    FastInit.onload();
  }
  scripts.each(function(script)
    {
      if ( script != '' )
      {
        if ( Prototype.Browser.IE && window.execScript )
        {
          ( function()
            {
              window.execScript( script );
            }.delay( scriptExecutionDelay ) );
        }
        else
        {
          ( function()
            {
              var scriptElem = new Element( 'script',
              {
                type : 'text/javascript'
              } );
              var head = $$( 'head' )[ 0 ];
              script = document.createTextNode( script );
              scriptElem.appendChild( script );
              head.appendChild( scriptElem );
              head.removeChild( scriptElem );
           }.delay( scriptExecutionDelay ) );
        }
      }
    }
  );
  if (signalObject)
  {
    if ( typeof( signalObject.evaluatingScripts ) === "function" )
    {
      ( function()
      {
        signalObject.evaluatingScripts();
        signalObject.evaluatingScripts = false; //reset function so another call will not unintentionally call this callback function.
      }.defer() );
    }
    else
    {
      signalObject.evaluatingScripts = false;
    }
  }
};

//When the browser page is resized, we use page.onResizeCleanSlateIframe( widthRate ) to determine the new width for the iframe.
page.onResizeCleanSlateIframe = function( widthRatio )
{
  var iframeElement = $$('iframe.cleanSlate')[0];
  var iframeParentWidth = iframeElement.parentElement.scrollWidth;

  //We resize the iframe width according its parent element width(container width) and the ratio ( the ratio of iframe width to it's parent width).
  iframeElement.style.width = parseInt( iframeParentWidth * widthRatio) + 'px';
}

//Set iframe height and width for fitting the size of embedded content.
//This function is only called in method renderFileContentBody(...) in ContentRendererUtil.java when the iframe has been loaded.
page.setIframeHeightAndWidth = function ()
{
  try
  {
    var iframeElement = $$('iframe.cleanSlate')[0];

    // Set default height and width for the iframe so that if any un-handled situation happens in this function,
    // the iframe still can be showed properly.
    var defaultHeight = 400;
    iframeElement.style.height = defaultHeight + 'px';
    iframeElement.style.width = '100%';

    // If the current url of iframe is not file content url, we don't set the height and width.
    if ( iframeElement.contentDocument.URL.indexOf("/bbcswebdav") === -1 )
    {
      return;
    }

    // Start to handle the situation which the embedded file content contains multiple iframes/frames.
    var iframeHeight = iframeElement.contentDocument.body.scrollHeight;
    var iframeWidth = iframeElement.contentDocument.body.scrollWidth
    var containedFrames = [iframeElement.contentDocument.getElementsByTagName("frame") ,
                           iframeElement.contentDocument.getElementsByTagName("iframe")];
    var isContainsMultiFrames = ( containedFrames[0].length === 0 && containedFrames[1].length === 0 ) ? false : true;

    if ( isContainsMultiFrames === true )
    {
      var maxSizeArray =  getMaxIframeContentSize();
      iframeHeight = maxSizeArray.height;
      iframeWidth = maxSizeArray.width;
    }

    iframeElement.style.height = (iframeHeight > defaultHeight ? iframeHeight: defaultHeight) + 'px';
    iframeElement.style.width = iframeWidth + 'px';

    // As the iframe width is specified in 'px' above, causes the width would stay same when the browser page is resized,
    // so we attach 'onresize' listener here and then use page.onResizeCleanSlateIframe( widthRate ) to determine the new width for the iframe.
    var widthRatio = iframeWidth/iframeElement.parentElement.scrollWidth;  // record the ratio of iframe width to its parent element width (container width) for caculating the new width.
    Event.observe( window, 'resize', page.onResizeCleanSlateIframe( widthRatio ) );
  }
  catch(e){}

  // Go through all contained frames/Iframes for getting the max height and width.
  // TODO: Should handle iframeset in this function.
  function getMaxIframeContentSize()
  {
     var i = 0;
     var maxHeight = iframeHeight;
     var maxWidth = iframeWidth;

     try
     {
       for( i = 0; i < containedFrames.length; i++ )
       {
         var j = 0;
         for( j = 0; j < containedFrames[i].length; j++ )
         {
            var h = containedFrames[i][j].contentWindow.document.body.scrollHeight;
            var w = containedFrames[i][j].contentWindow.document.body.scrollWidth;
            maxHeight = ( maxHeight > h ) ? maxHeight : h;
            maxWidth = ( maxWidth > w ) ? maxWidth : w;
         }
       }
     }
     catch (e){}

     return {height:maxHeight , width:maxWidth};
  }
};

page.onResizeChannelIframe = function( channelExtRef )
{
  var frameId = 'iframe' + channelExtRef;
  var listId = 'list_channel' + channelExtRef;
  var f = $( frameId );
  var fli = f.contentWindow.document.getElementById( listId );
  if (fli)
  {
    f.style.height = fli.scrollHeight + 15 + "px";
  }
};

/**
 * Contains page-wide utility methods
 */
page.util = {};

/**
 * Returns whether the specific element has the specified class name.
 * Same as prototype's Element.hasClassName, except it doesn't extend the element (which is faster in IE).
 */
page.util.hasClassName = function ( element, className )
{
  var elementClassName = element.className;
  if ((typeof elementClassName == "undefined") || elementClassName.length === 0)
  {
    return false;
  }
  if (elementClassName == className ||
      elementClassName.match(new RegExp("(^|\\s)" + className + "(\\s|$)")))
  {
    return true;
  }

  return false;
};

page.util.fireClick = function ( elem )
{
  if (Prototype.Browser.IE)
  {
    elem.fireEvent("onclick");
  }
  else
  {
    var evt = document.createEvent("HTMLEvents");
    evt.initEvent("click", true, true);
    elem.dispatchEvent(evt);
  }
};

// Find an element with the given className, starting with the element passed in
page.util.upToClass = function ( element, className )
{
  while (element && !page.util.hasClassName(element, className))
  {
    element = element.parentNode;
  }
  return $(element);
};

page.util.isRTL = function ()
{
  var els = document.getElementsByTagName("html");
  var is_rtl = (typeof(els) != 'undefined' &&
          els && els.length == 1 && els[0].dir == 'rtl' );
  return is_rtl ;
};

page.util.allImagesLoaded = function (imgList)
{
  var allDone = true;
  if (imgList)
  {
    for ( var i = 0, c = imgList.length; i < c; i++ )
    {
      var animg = imgList[i];
      // TODO - this doesn't appear to work on IE.
      if ( !animg.complete )
      {
        allDone = false;
        break;
      }
    }
  }
  return allDone;
};

// Exposes (display but keep invisible) an invisible element for measurement
// recursively traverses up the DOM looking for
// a parent node of element whose display == 'none'
// If found, sets its style to: display:block, position:absolute, and visibility:hidden
// and saves it as element.hiddenNode so it can be easily unexposed
page.util.exposeElementForMeasurement = function ( element )
{
  element = $(element);
  var e = element;
  var hiddenNode;
  // find parent node that is hidden
  while ( !hiddenNode && e && e.parentNode)
  {
    if ( $(e).getStyle('display') === 'none')
    {
      hiddenNode = $(e);
    }
    e = $(e.parentNode);
  }
  if ( hiddenNode )
  {
    // save original style attributes: visibility, position, & display
    element.hiddenNode = hiddenNode;
    var style = hiddenNode.style;
    var originalStyles = {
                          visibility: style.visibility,
                          position:   style.position,
                          display:    style.display
                        };
    var newStyles = {
                     visibility: 'hidden',
                     display:    'block'
                   };

     if (originalStyles.position !== 'fixed')
     {
       newStyles.position = 'absolute';
     }
     hiddenNode.originalStyles = originalStyles;
     // set new style for: visibility, position, & display
     hiddenNode.setStyle( newStyles );
  }

};

// undo previous call to exposeElementForMeasurement
page.util.unExposeElementForMeasurement = function ( element )
{
  element = $(element);
  if ( element && element.hiddenNode && element.hiddenNode.originalStyles )
  {
    Element.setStyle( element.hiddenNode, element.hiddenNode.originalStyles );
    element.hiddenNode.originalStyles = null;
    element.hiddenNode = null;
  }

};


/**
 * Returns whether any part of the two elements overlap each other.
 */
page.util.elementsOverlap = function ( e1, e2 )
{
  var pos1 = $(e1).cumulativeOffset();
  var a = { x1: pos1.left, y1: pos1.top, x2: pos1.left + e1.getWidth(), y2: pos1.top + e1.getHeight() };
  var pos2 = $(e2).cumulativeOffset();
  var b = { x1: pos2.left, y1: pos2.top, x2: pos2.left + e2.getWidth(), y2: pos2.top + e2.getHeight() };

  return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
};
/**
 *  To handle the case where the focus is visible but too close to the
    bottom of the page, scroll the page up a bit.
    Note: when using scrollbar.js, use scrollBar.scrollTo() rather than focusAndScroll
*/

page.util.focusAndScroll= function(elem)
{
  elem.focus();

  return page.util.ensureVisible(elem);
};

page.util.ensureVisible= function(elem)
{
  var scrolltop = document.viewport.getScrollOffsets().top;
  var mytop = elem.cumulativeOffset()[1];
  var height = document.viewport.getDimensions().height;
  var realtop = mytop - scrolltop;
  var thirty = height * 0.3;
  if (realtop > (height-thirty))
  {
    var scrollDistance = realtop - thirty;
    window.scrollBy(0,scrollDistance);
  }
  return false;
};

page.util.processJSProtoString = function (string, checkToken) {
  // This value must match the value passed as the 2nd parameter to this string.
  // The goal is to pass a known value, as a constant, through the javascript: pseudo-protocol
  // handler. We can then examine the result to determine the decoding method used by the current
  // browser.
  var sniffToken = '%C3%A9';

  // There are three known decoding cases, non-translated, UTF8, and unescape
  if (checkToken === unescape(sniffToken)) {
    // Unescape decoded
    return decodeURIComponent(escape(string));
  } else if (checkToken === sniffToken) {
    // Non-translated
    return decodeURIComponent(string);
  } else {
    // UTF8 Decoded/Unknown
    return string;
  }
};

/**
 * Find the first action bar that precedes sourceElement
 * Returns the action bar div element if found, null otherwise
 *
 * @param sourceElement
 */
page.util.findPrecedingActionBar = function( sourceElement )
{
  var actionBar = null;
  // Loop through each ancestor of sourceElement,
  // starting with parent, until an action bar is found
  sourceElement.ancestors().each( function( item )
  {
    actionBar = item.previous('div.tabActionBar') ||
                item.previous('div.actionBarMicro') ||
                item.previous('div.actionBar');
    if (actionBar)
    {
      throw $break;
    }
  });
  return actionBar;
};

page.util.getLargestDimensions = function (element)
{
  var width = 0;
  var height = 0;
  var dim;
  while (element != document)
  {
    dim = $(element).getDimensions();
    if (dim.width > width)
    {
      width = dim.width;
    }
    if (dim.height > height)
    {
      height = dim.height;
    }
    element = element.up();
  }
    return { width: width, height: height };
};

/*
 * Resize the current window so that it will fit the largest dimensions found for the given element.
 * Will also reposition on the screen if required to fit.  Will not size larger than the screen.
 * NOTE that this will only work for popup windows - main windows are typically in a tabset in
 * the browser and they don't allow resizing like this.  That's OK because the main use case
 * for this method is to make sure popup windows are resized appropriately for their content.
 */
page.util.resizeToContent = function (startElement)
{
    var dim = page.util.getLargestDimensions(startElement);
    var newWidth = dim.width;
    newWidth += 25; // TODO: Haven't figured out why I need this extra space yet...
    if (window.innerWidth > newWidth)
    {
      newWidth = window.innerWidth;
    }
    if (newWidth > screen.width)
    {
      newWidth = screen.width;
    }

    var newHeight = dim.height;
    newHeight += 100; // TODO: Haven't figured out why I need this extra space yet
    if (window.innerHeight > newHeight)
    {
      newHeight = window.innerHeight;
    }
    if (newHeight > screen.height)
    {
      newHeight = screen.height;
    }

    var left = 0;
    var top = 0;
    if ( window.screenLeft )
    {
      left = window.screenLeft;
      top = window.screenTop;
    }
    else if ( window.screenX )
    {
      left = window.screenX;
      top = window.screenY;
    }
    if (left + newWidth > screen.width)
    {
      left = screen.width - newWidth;
      if (left < 0)
      {
        left = 0;
      }
    }
    if (top + newHeight > screen.height)
    {
      top = screen.height - newHeight;
      if (top < 0)
      {
        top = 0;
      }
    }
    window.moveTo(left,top);
    window.resizeTo(newWidth,newHeight);
};

/**
 * Sets the css position of all li elements that are contained in action bars on the page.
 * Since z-index only works on positioned elements, this function can be used to ensure that
 * divs with a higher z-index will always appear on top of any action bars on the page.
 *
 * @param cssPosition
 */
page.util.setActionBarPosition = function( cssPosition )
{
  $$( 'div.actionBar',
      'div.tabActionBar',
      'div.actionBarMicro' ).each( function( actionbar )
  {
    actionbar.select( 'li' ).each( function( li )
    {
      li.setStyle( {position: cssPosition} );
    });
  });
};

/**
 * Returns true if we are currently running inside Ultra, false otherwise.
 * @returns {Boolean}
 */
page.util.insideUltra = function()
{
  if ( top.__isUltraApp )
  {
    return true;
  }
  return false;
};

/**
 * Returns true if the current window's parent is the Ultra app, false otherwise.
 * @returns {Boolean}
 */
page.util.parentWindowIsUltraApp = function()
{
  if ( parent.__isUltraApp )
  {
    //adding class to body to isolate spoecific css styles for classic views served in Ultra, primarily for mobile breakpoints
    document.body.addClassName('isUltra');
    return true;
  }
  return false;
};

/**
 * Utility method to broadcast event to angular realm
 * @param {string} name Event name to broadcast.
 * @param {...*} args Optional one or more arguments which will be passed onto the event listeners.
 * @returns {boolean} True if angular is available, false otherwise.
 */
page.util.broadcastToUltra = function( name, args )
{
  if ( page.util.insideUltra() )
  {
    // Method upgraded to broadcast event from innermost window to top most window.
    // This will make sure it will check every window object until it has the event to broadcast.
    var currentWindow = window;
    var topWindow = window.top;
    var isTopWindow = false;
    while( currentWindow && !isTopWindow ) {
      isTopWindow = topWindow === window;
      if( currentWindow.angular ) {
        // Angular is available, so broadcast the event to Ultra
        var scope = currentWindow.angular.element( currentWindow.document ).injector().get( '$rootScope' );
        var broadcast = scope.$broadcast.apply( scope, arguments );
        // Once broadcasted successfully boradcasted will get currentScope property
        if( ( broadcast && broadcast.hasOwnProperty( 'currentScope' ) ) || topWindow === currentWindow ) {
          currentWindow = null;
        } else {
          currentWindow = currentWindow.parent;
        }
      } else {
        currentWindow = currentWindow.parent;
      }
    }

    // If the event is from the Administration Panel then returning anything (true, false, null) will cause Firefox
    // to display the value returned (even null) overwriting the Administration Panel. Then when the peek is closed
    // the Administration Panel is no longer displayed.
    if ( name.endsWith( "admin-panel-open" ) )
    {
      return;
    }
    return true;
  }
  return false;
};

/**
 * Utility methods to pin the bottom Submit step at the bottom of window or
 * container whichever is applicable.
 * This function is invoked on all the pages which have the submit button being rendered either via stepSubmit tag or directly.
 * The pages including, but not limited to,
 * Course Item create/edit page
 * Course Video create/edit page
 * Edit/reply discussion message(s) on Course discussion thread page
 * Institution Domain create/edit page
 * Institution Brand customize page
 * The classic edit page of Configure Collaborate Web Conference in light box (See LRN-112422)
 *
 * Any time this function is being updated, the pages above or any page has the Submit button need be manually tested. The test should be performed on
 * the emulated mobile devices in addition to the desktop. Also, the test needs cover the two supported themes, as_2012 and as_2015.
 */
page.util.pinBottomSubmitStep = function( bottomSubmit, lightboxDiv )
{
  var placeHolderDividerName = 'bottomSubmitPlaceHolder';
  var submitStepFixedStyle = 'submitStepFixed';
  var spaceUnderLightbox = 0;
  var isSubmitOutOfLightbox = false;
  var isContainerOutOfLightbox = false;

  var container = bottomSubmit.parentElement;
  var viewPortHeight = document.viewport.getDimensions().height;
  var isPinned = page.util.hasClassName(bottomSubmit, submitStepFixedStyle);
  // bottomSubmitPlaceHolder holds the place of submit step within the
  // container when the step is pinned to bottom of window to make sure the
  // container doesn't shrink.
  // It also be used to keep the original attributes for the submit step div, i.e. the width.
  var bottomSubmitPlaceHolder = document.getElementById(placeHolderDividerName);
  var bottomOfSubmit = parseInt(bottomSubmit.getBoundingClientRect().bottom, 10);

  if ( lightboxDiv && lightboxDiv.contains( container ) )
  {
    var bottomOfLightbox = parseInt(lightboxDiv.getBoundingClientRect().bottom, 10);
    spaceUnderLightbox = viewPortHeight - bottomOfLightbox;
    isContainerOutOfLightbox = (parseInt(container.getBoundingClientRect().bottom, 10) > bottomOfLightbox);
    isSubmitOutOfLightbox = (bottomOfSubmit > bottomOfLightbox);
  }

  // In case the bottom of submit button is below then the bottom of window, or the container/submit button is out of available light box,
  // pin the submit step to the bottom of browser by adding the css class 'submitStepFixed'.
  if (!isPinned && (( viewPortHeight - bottomOfSubmit ) < 0  || isContainerOutOfLightbox || isSubmitOutOfLightbox)) {
    bottomSubmit.addClassName(submitStepFixedStyle);
    if ( spaceUnderLightbox >0 )
    {
      bottomSubmit.style.marginBottom = spaceUnderLightbox+'px';
    }
    page.util.setPinnedBottomSubmitStepWidth( bottomSubmit, container );
    if ( !bottomSubmitPlaceHolder ) {
      bottomSubmitPlaceHolder = document.createElement('div');
      bottomSubmitPlaceHolder.id = placeHolderDividerName;
      container.insertBefore(bottomSubmitPlaceHolder,bottomSubmit);
    }
    bottomSubmitPlaceHolder.style.height = bottomSubmit.getDimensions().height + 'px';
  }
  else if ( isPinned ) {
  //The width of the pinned submit button div might need be updated upon the event of resizing.
    page.util.setPinnedBottomSubmitStepWidth( bottomSubmit, container );

    // The submit button div should be set back to the container by removing the class 'submitStepFixed'
    // if the top of submit button is higher than the place holder.
    if ( !bottomSubmitPlaceHolder || (bottomSubmit.getBoundingClientRect().top > bottomSubmitPlaceHolder.getBoundingClientRect().top) ) {
      if ( bottomSubmitPlaceHolder ) {
        bottomSubmit.style.width = bottomSubmitPlaceHolder.style.width;
        bottomSubmitPlaceHolder.remove();
      }
      bottomSubmit.style.marginBottom = 'auto';
      bottomSubmit.removeClassName( submitStepFixedStyle );
    }
  }
};

/**
 * Refresh pinning the bottom buttons. 
 */
page.util.refreshPinBottomSubmitStep = function( ) {
  var bottomSubmitToBePinned = page.util.getBottomSubmitStep();
  var lightboxDiv = page.util.upToClass( bottomSubmitToBePinned, "lb-content" );
  if ( lightboxDiv && bottomSubmitToBePinned ) 
  {
    page.util.pinBottomSubmitStep(bottomSubmitToBePinned, lightboxDiv); 
  }
};

/**
 * Sets the width for the pinned bottom submit div.
 */
page.util.setPinnedBottomSubmitStepWidth = function( pinnedBottomSubmit, container )
{
  var computedStyle;
  if (document.defaultView && document.defaultView.getComputedStyle) {
    computedStyle = document.defaultView.getComputedStyle(pinnedBottomSubmit, null);
  };
  var pinnedButtonWidth = container.offsetWidth;
  if( pinnedButtonWidth == 0 )
  {
    //Generally, the 'container' comes from 'dataCollectionContainer', which contains the appropriate width
    //for the offset.  Sometimes, the container fetches the wrong parent (nested <style> object) which contains
    //0 width, which will pin the submit container to the far left.
    pinnedButtonWidth = document.getElementById("dataCollectionContainer").offsetWidth;
  }
  if ( computedStyle ) {
    if ( computedStyle.paddingLeft) {
      pinnedButtonWidth = pinnedButtonWidth - parseInt(computedStyle.paddingLeft, 10);
    }
    if ( computedStyle.paddingRight){
      pinnedButtonWidth = pinnedButtonWidth - parseInt(computedStyle.paddingRight, 10);
      }
    }
  pinnedBottomSubmit.style.width = pinnedButtonWidth + 'px';
};

/**
 * Utility to invoke page.util.pinBottomSubmitStep function initially
 * and bind the function to the events of resize, scroll and menu toggling.
 */
page.util.initPinBottomSubmitStep = function() {
  var bottomSubmitToBePinned = page.util.getBottomSubmitStep();
  if (!bottomSubmitToBePinned) {
    return;
  }
  var lightboxDiv = page.util.upToClass( bottomSubmitToBePinned, "lb-content" );
  if ( lightboxDiv ) {
    Event.observe(lightboxDiv, 'resize', function() {page.util.pinBottomSubmitStep(bottomSubmitToBePinned, lightboxDiv)})
    Event.observe(lightboxDiv, 'scroll', function() {page.util.pinBottomSubmitStep(bottomSubmitToBePinned, lightboxDiv)});
   } else {
    //Invoke the pinBottomSubmitStep initially if the submit button div is not in a light box.
    //If the submit button is in a light box, pinBottomSubmitStep is called by _initializeBottomSubmitStep() from
    //lightbox.js which is guaranteed to be executed after the light box content being fully rendered.
    page.util.pinBottomSubmitStep( bottomSubmitToBePinned, null );
  }

  //The resize and scroll event could be fired either on window or body element according to the overflow setting,
  //therefore the pinning function is bound to both events.
  Event.observe(window, 'resize', function() {page.util.pinBottomSubmitStep(bottomSubmitToBePinned, lightboxDiv)});
  Event.observe(window, 'scroll', function() {page.util.pinBottomSubmitStep(bottomSubmitToBePinned, lightboxDiv)});
  var body = document.getElementsByTagName("body")[0];
  if (body) {
    Event.observe(body, 'resize', function() {page.util.pinBottomSubmitStep(bottomSubmitToBePinned, lightboxDiv)});
    Event.observe(body, 'scroll', function() {page.util.pinBottomSubmitStep(bottomSubmitToBePinned, lightboxDiv)});
  }
  // also bind to the custom event so we can use Event.fire(window, "bb:resize") in other places
  Event.observe(window, 'bb:resize', function() {page.util.pinBottomSubmitStep(bottomSubmitToBePinned, lightboxDiv)});

  page.util.registerScrollTotopIfCovered(bottomSubmitToBePinned.parentElement, bottomSubmitToBePinned);

  //Adjust the sticky footer upon the menu toggling event.
  (function() {
    if ( page.PageMenuToggler.toggler ) {
      page.PageMenuToggler.toggler.addToggleListener( function( isOpen ) {
        page.util.pinBottomSubmitStep(bottomSubmitToBePinned, lightboxDiv)
      });
    }
  }.defer());
};

/**
 * Register focus event handler to all the elements within same container of the submit button div,
 * so that the page will be lifted up in case the focused element is covered by the submit button.
 */
page.util.registerScrollTotopIfCovered = function( parent, bottomSubmit) {
  var children = parent.childNodes;
  for (var i=0; i<children.length; i++) {
    if (children[i] != bottomSubmit) {
      if (children[i].childNodes.length>0) {
        page.util.registerScrollTotopIfCovered(children[i],bottomSubmit);
      } else {
        Event.observe( children[i], 'focus', page.util.scrollTotopIfCovered.bindAsEventListener( this, bottomSubmit ) );
      }
    }
  }
}

/**
 * If the element associated with the event if covered by the bottom submit div,
 * lift the page via scrollIntoView method.
 */
page.util.scrollTotopIfCovered = function(event, bottomSubmit) {
  var focusedElement = Event.element(event);
  var bottomOfFocusedElement = parseInt(focusedElement.getBoundingClientRect().bottom, 10);
  var topOfFooter = parseInt(bottomSubmit.getBoundingClientRect().top, 10);
  if (bottomOfFocusedElement > topOfFooter) {
    focusedElement.scrollIntoView(true);
  }
}

/**
 * The method returns the element contains the submit button. This element needs be pinned at the bottom of window or
 * container whichever is applicable.
 */
page.util.getBottomSubmitStep = function() {
  var bottomSubmitStep;
  var navStatusPanelButtonsBottom = document.getElementById("navStatusPanelButtons_bottom");
  if (navStatusPanelButtonsBottom){
    bottomSubmitStep = navStatusPanelButtonsBottom.parentElement;
  }
  if (!bottomSubmitStep) {
    bottomSubmitStep = document.getElementById("pinnedBottomBar");
  }
  if (!bottomSubmitStep) {
    bottomSubmitStep = document.getElementsByClassName("submitStepBottom")[0];
  }
  if (!bottomSubmitStep) {
      bottomSubmitStep = document.getElementById("submitButtonRow");
  }
  if (!bottomSubmitStep) {
    var submitButtonRow = document.getElementById("bottom_submitButtonRow");
    if ( submitButtonRow )
    {
      bottomSubmitStep = submitButtonRow.parentElement;
    }
  }
  return bottomSubmitStep;
};

/**
 * We have many anchor elements with a role of 'button' that present something visually looking like a button but that
 * do not respond to 'space' to press them as you would expect of a button. This will setup space to fire the click
 * event on any element with a role of 'button'.
 */
page.GlobalBehaviour = Class.create();
page.GlobalBehaviour.prototype =
{
  initialize : function()
  {
    Event.observe( window, 'keydown', this.handleKeyDown.bindAsEventListener( this ) );

  },
  handleKeyDown : function( event )
  {
    var code = event.keyCode || event.which;
    var elem = event.element();
    // space (32) on an anchor tag, or enter key (13)
    if ( (code == 32 && elem.nodeName.toUpperCase() === 'A') || code == 13)
    {
      var role = elem.getAttribute("role");
      var type = elem.getAttribute("type");
      if (role && role == "button" && type != "submit")
      {
        page.util.fireClick( elem );
        $(event).preventDefault();
      }
    }
  }
};
/** We want this behaviour everywhere so establish it immediately.*/
page.theGlobalBehaviour = new page.GlobalBehaviour();

/**
 * Class for controlling the course menu-collapser.  Also ensures the menu is
 * the right height
 */
page.PageMenuToggler = Class.create();
page.PageMenuToggler.prototype =
{
  /**
   * initialize
   */
  initialize: function( isMenuOpen,key,temporaryScope )
  {
    page.PageMenuToggler.toggler = this;
    this.key = key;
    if (temporaryScope)
    {
      this.temporaryScope = temporaryScope;
    }
    else
    {
      this.temporaryScope = false;
    }
    this.isMenuOpen = isMenuOpen;
    this.puller = $('puller');
    this.menuPullerLink = $(this.puller.getElementsByTagName('a')[0]);
    this.menuContainerDiv = $('menuWrap');
    this.navigationPane = $('navigationPane');
    this.contentPane = $('contentPanel') || $('contentPane');
    this.navigationPane = $('navigationPane');
    this.locationPane = $(this.navigationPane.parentNode);
    this.globalContent = $(this.locationPane.parentNode);
    this.body = $(this.globalContent.parentNode);
    this.breadcrumbBar = $('breadcrumbs');

    this.menu_pTop = parseInt(this.menuContainerDiv.getStyle('paddingTop'), 10);
    this.menu_pBottom = parseInt(this.menuContainerDiv.getStyle('paddingBottom'), 10);
    this.loc_pTop = parseInt(this.locationPane.getStyle('paddingTop'), 10);

    if ( this.breadcrumbBar )
    {
      this.bc_pTop = parseInt(this.breadcrumbBar.getStyle('paddingTop'), 10);
      this.bc_pBottom = parseInt(this.breadcrumbBar.getStyle('paddingBottom'), 10);
    }
    else
    {
      this.bc_pTop = 0;
      this.bc_pBottom = 0;
    }

    this.toggleListeners = [];
    this.onResize( null );  // fix the menu size

    Event.observe( window, 'resize', this.onResize.bindAsEventListener( this ) );
    Event.observe( this.menuPullerLink, 'click', this.onToggleClick.bindAsEventListener( this ) );
  },

  collapseCourseMenuIfWidthTooSmall: function()
  {
    if ( this.isLessThanMinWidthToDisplayCourseMenu() && this.isMenuOpen )
    {
      this.collapse();
    }
  },

  isLessThanMinWidthToDisplayCourseMenu: function()
  {
    var width = document.viewport.getWidth();
    // 768px is the iPad width
    var minWidthToAutoCollapseInPx = 1038;
    return width < minWidthToAutoCollapseInPx;
  },

  /**
   * Adds a listener for course menu toggle events
   */
  addToggleListener: function( listener )
  {
    this.toggleListeners.push( listener );
  },

  /**
   * Notifies all registered toggle event listeners that a toggle has occurred.
   */
  _notifyToggleListeners: function( isOpen )
  {
    this.toggleListeners.each( function( listener )
    {
      listener( isOpen );
    });
  },

  notifyToggleListeners: function( isOpen )
  {
    // we call once the toggle is complete and the DOM in its new state. 2012 themes add transition, which seems
    // to collide with the logic to get dimensions of dom element, so the delay is a 1 sec to let time for those
    // transitions to be done.
    this._notifyToggleListeners.bind( this, isOpen ).delay( 1 );
  },
  /**
   * getAvailableResponse
   */
  getAvailableResponse : function ( req  )
  {
    var originalMenuOpen = this.isMenuOpen ;
    if ( req.responseText.length > 0 )
    {
      if ( req.responseText == 'true' )
      {
        this.isMenuOpen = true;
      }
      else
      {
        this.isMenuOpen = false;
    }
    }

    if ( originalMenuOpen != this.isMenuOpen )
    {
      this.notifyToggleListeners( this.isMenuOpen );
      this.menuContainerDiv.toggle();
      this.puller.toggleClassName("pullcollapsed");
      this.contentPane.toggleClassName("contcollapsed");
      this.navigationPane.toggleClassName("navcollapsed");
      this.body.addClassName("bodynavcollapsed");
    }
  },



  /**
   * Expands the menu.  This can be used instead of toggling to explicitly
   * change the visibility of the menu.
   */
  expand : function ()
  {
    this.menuContainerDiv.show();
    this.puller.removeClassName("pullcollapsed");
    this.contentPane.removeClassName("contcollapsed");
    this.navigationPane.removeClassName("navcollapsed");
    this.body.removeClassName("bodynavcollapsed");

    this.isMenuOpen = true;

    var msg = page.bundle.messages[ "coursemenu.hide" ];
    this.menuPullerLink.title = msg;
    $('expander').alt = msg;

    this.notifyToggleListeners( true );
    if (this.temporaryScope)
    {
      UserDataDWRFacade.setStringTempScope( this.key, true );
    }
    else
    {
      UserDataDWRFacade.setStringPermScope( this.key, true );
    }
  },

  /**
   * Collapses the menu.  This can be used instead of toggling to explicitly
   * change the visibility of the menu.
   */
  collapse : function ()
  {
    this.menuContainerDiv.hide();
    this.puller.addClassName("pullcollapsed");
    this.contentPane.addClassName("contcollapsed");
    this.navigationPane.addClassName("navcollapsed");
    this.body.addClassName("bodynavcollapsed");

    this.isMenuOpen = false;

    var msg = page.bundle.messages[ "coursemenu.show" ];
    this.menuPullerLink.title = msg;
    $('expander').alt = msg;

    this.notifyToggleListeners( false );
    if (this.temporaryScope)
    {
      UserDataDWRFacade.setStringTempScope( this.key, false );
    }
    else
    {
      UserDataDWRFacade.setStringPermScope( this.key, false );
    }
  },

  /**
   * Event triggered when the puller toggle control is clicked.  Changes the
   * menu from open to closed or closed to open depending on existing state.
   */
  onToggleClick: function( event )
  {
    if ( this.isMenuOpen )
    {
      this.collapse();
    }
    else
    {
      this.expand();
    }
    Event.stop( event );
  },

  /**
   * onResize
   */
  onResize: function( event )
  {
      this.collapseCourseMenuIfWidthTooSmall();
  }
};
page.PageMenuToggler.toggler = null;

/**
 *  Class for controlling the page help toggler in the view toggle area
 */
page.PageHelpToggler = Class.create();
page.PageHelpToggler.prototype =
{
  initialize: function( isHelpEnabled, showHelpText, hideHelpText, assumeThereIsHelp )
  {
    page.PageHelpToggler.toggler = this;
    this.toggleListeners = [];
    this.isHelpEnabled = isHelpEnabled;
    this.showText = showHelpText;
    this.hideText = hideHelpText;
    this.contentPanel = $('contentPanel') || $('contentPane');
    var helperList = [];
    if ( this.contentPanel && !assumeThereIsHelp)
    {
      var allElems = [];
      allElems = allElems.concat( $A(this.contentPanel.getElementsByTagName('p') ) );
      allElems = allElems.concat( $A(this.contentPanel.getElementsByTagName('div') ) );
      allElems = allElems.concat( $A(this.contentPanel.getElementsByTagName('li') ) );
      allElems = allElems.concat( $A(this.contentPanel.getElementsByTagName('span') ) );
      for ( var i = 0; i < allElems.length; i++ )
      {
        var el = allElems[i];
        if ( page.util.hasClassName( el, 'helphelp' ) ||
             page.util.hasClassName( el, 'stepHelp' ) ||
             page.util.hasClassName( el, 'taskbuttonhelp' ) ||
             page.util.hasClassName( el, 'pageinstructions' ) )
        {
          helperList.push( $(el) );
        }
      }
    }

    var helpTextToggleLink = $('helpTextToggleLink');
    if ( ( !helperList || helperList.length === 0) && !assumeThereIsHelp )
    {
      if ( helpTextToggleLink )
      {
        helpTextToggleLink.remove();
      }
    }
    else
    {
      if ( !isHelpEnabled )
      {
        helperList.invoke( "toggle" );
      }

      if ( !this.showText )
      {
        this.showText = page.bundle.getString("viewtoggle.editmode.showHelp");
      }

      if ( !this.hideText )
      {
        this.hideText = page.bundle.getString("viewtoggle.editmode.hideHelp");
      }

      helpTextToggleLink.style.display = 'inline-block';
      this.toggleLink = helpTextToggleLink;
      this.toggleImage = $(this.toggleLink.getElementsByTagName('img')[0]);
      Event.observe( this.toggleLink, "click", this.onToggleClick.bindAsEventListener( this ) );
      $(this.toggleLink.parentNode).removeClassName('hidden');
      this.updateUI();
    }
  },

  addToggleListener: function( listener )
  {
    this.toggleListeners.push( listener );
  },

  _notifyToggleListeners: function()
  {
    this.toggleListeners.each( function( listener )
    {
      listener( this.isHelpEnabled );
    });
  },

  notifyToggleListeners: function()
  {
    // we notify once the whole menu collapse/expand is done, so the DOM is in final state
    this._notifyToggleListeners.bind( this ).delay( );
  },


  updateUI: function( )
  {
    if ( this.isHelpEnabled )
    {
      $("showHelperSetting").value = 'true';
      this.toggleImage.src = getCdnURL( "/images/ci/ng/small_help_on2.gif" );
      this.toggleLink.setAttribute( "title", this.showText );
      this.toggleImage.setAttribute( "alt", this.showText );
    }
    else
    {
      $("showHelperSetting").value = 'false';
      this.toggleImage.src = getCdnURL( "/images/ci/ng/small_help_off2.gif" );
      this.toggleLink.setAttribute( "title", this.hideText );
      this.toggleImage.setAttribute( "alt", this.hideText );
    }
  },

  toggleHelpText : function( isEnabled )
  {
    if ( this.contentPanel )
    {
      var allElems = [];
      allElems = allElems.concat( $A(this.contentPanel.getElementsByTagName('p') ) );
      allElems = allElems.concat( $A(this.contentPanel.getElementsByTagName('div') ) );
      allElems = allElems.concat( $A(this.contentPanel.getElementsByTagName('li') ) );
      allElems = allElems.concat( $A(this.contentPanel.getElementsByTagName('span') ) );

      for ( var i = 0; i < allElems.length; i++ )
      {
        var el = allElems[i];
        if ( page.util.hasClassName( el, 'helphelp' ) ||
             page.util.hasClassName( el, 'stepHelp' ) ||
             page.util.hasClassName( el, 'taskbuttonhelp' ) ||
             page.util.hasClassName( el, 'pageinstructions' ) )
        {
          if(isEnabled) //if we upgrade to prototype 7.1, then we can just do $(el).toggle(isEnabled)
          $(el).show();
          else
          $(el).hide();
        }
      }
    }
  },

  onToggleClick: function( event )
  {
    // Toggle all elements that have the css class "helphelp"
    var helperList = [];

    if ( this.isHelpEnabled )
    {
      this.isHelpEnabled = false;
      UserPageInstructionsSettingDWRFacade.setShowPageInstructions( "false" );
    }
    else
    {
      this.isHelpEnabled = true;
      UserPageInstructionsSettingDWRFacade.setShowPageInstructions( "true" );
    }
    //after updating isHelpEnabled value, actually change the text visibility
    this.toggleHelpText( this.isHelpEnabled );

    this.updateUI();
    this.notifyToggleListeners();
    Event.stop( event );
  }
};

/**
 * Class for controlling the display of a context menu.
 */
page.ContextMenu = Class.create();
page.ContextMenu.prototype =
{
  initialize: function( contextMenuContainer, divId, forceMenuRefresh )
  {
    this.displayContextMenuLink = contextMenuContainer.down("a.cmimg");
    // in grade-center screen reader mode 'cmimg' class is removed.
    // insertAccessibleContextMenu method in gradebookgrid_cellctrl.js removes the 'cmimg' class
    if ( !this.displayContextMenuLink )
    {
      this.displayContextMenuLink = contextMenuContainer.down('a');
    }
    this.contextMenuContainer = contextMenuContainer;
    this.forceMenuRefresh = forceMenuRefresh;
    this.uniqueId = this.displayContextMenuLink.id.split('_')[1];
    this.contextMenuDiv = this.displayContextMenuLink.savedDiv;
    if ( !this.contextMenuDiv )
    {
      this.contextMenuDiv = contextMenuContainer.down("div");//$('cmdiv_' + this.uniqueId);
      if ( !this.contextMenuDiv )
      {
        this.contextMenuDiv = page.ContextMenu.locateMenuDiv( this.displayContextMenuLink, this.uniqueId );
      }
      this.displayContextMenuLink.savedDiv = this.contextMenuDiv;
      page.ContextMenu.hiddenDivs.set(divId,this.contextMenuDiv);
    }

    this.originalContextMenuDiv = this.contextMenuDiv.cloneNode(true);
    $(this.contextMenuDiv).setStyle({zIndex: 200});
    this.displayContextMenuLink.appendChild( this.contextMenuDiv ); // Temporarily add the menu back where it started
    this.closeContextMenuLink = contextMenuContainer.down(".contextmenubar_top").down(0);
    this.contextParameters = contextMenuContainer.readAttribute("bb:contextParameters");
    this.menuGeneratorURL = contextMenuContainer.readAttribute("bb:menuGeneratorURL");
    this.nav = contextMenuContainer.readAttribute("bb:navItem");
    this.enclosingTableCell = contextMenuContainer.up("td");
    this.menuOrder = contextMenuContainer.readAttribute("bb:menuOrder");
    this.overwriteNavItems = contextMenuContainer.readAttribute("bb:overwriteNavItems");
    this.beforeShowFunc = contextMenuContainer.readAttribute("bb:beforeShowFunc");
    if (this.beforeShowFunc)
    {
      this.beforeShowFunc = eval(this.beforeShowFunc);
    }

    if ( this.menuOrder )
    {
      this.menuOrder = this.menuOrder.split(',');
    }

    if ( !this.contextParameters )
    {
      this.contextParameters = "";
    }

    if ( !this.menuGeneratorURL )
    {
      this.menuGeneratorURL = "";
    }

    if ( !this.nav )
    {
      this.nav = "";
    }

    this.dynamicMenu = false;

    if ( this.menuGeneratorURL )
    {
      this.dynamicMenu = true;
    }

    // Process dynamic menus to hide contextMenuLinks if it is for an empty menu. Do that before attaching events to the links
    this.processDynamicMenu();

    if (this.dynamicMenu)
    {
      Event.observe( this.displayContextMenuLink, "click", this.generateDynamicMenu.bindAsEventListener( this ) );
      Event.observe( this.displayContextMenuLink, 'keydown', function()
      {
        if (event.code === 'Space')
        {
          // Space key opens the context menu
          this.generateDynamicMenu(event);
        }
      }.bindAsEventListener(this));
    }
    else
    {
      Event.observe( this.displayContextMenuLink, "click", this.onDisplayLinkClick.bindAsEventListener( this ) );
      Event.observe( this.displayContextMenuLink, 'keydown', function()
      {
        if (event.code === 'Space')
        {
          // Space key opens the context menu
          this.onDisplayLinkClick(event);
        }
      }.bindAsEventListener(this));
    }

    Event.observe( this.closeContextMenuLink, "click", this.onCloseLinkClick.bindAsEventListener( this ) );
    Event.observe( this.contextMenuDiv, "keydown", this.onKeyPress.bindAsEventListener( this ) );

    // adding nowrap to table cell containing context menu
    // If no enclosing td is found, try th
    if ( !this.enclosingTableCell )
    {
      this.enclosingTableCell = contextMenuContainer.up("th");
    }

    if ( this.enclosingTableCell )
    {
      if ( !this.enclosingTableCell.hasClassName("nowrapCell") )
      {
        this.enclosingTableCell.addClassName("nowrapCell");
      }

      // if label tag is an immediate parent of context menu span tag, it needs nowrap as well
      if ( this.enclosingTableCell.down("label") && !this.enclosingTableCell.down("label").hasClassName("nowrapLabel"))
      {
        this.enclosingTableCell.down("label").addClassName("nowrapLabel");
      }
    }

    if ( !this.dynamicMenu )
    {
      var contexMenuItems = contextMenuContainer.getElementsBySelector("li > a").each( function (link )
      {
        if ( !link.up('li').hasClassName("contextmenubar_top") )
        {
          Event.observe( link, 'focus', this.onAnchorFocus.bindAsEventListener( this ) );
          Event.observe( link, 'blur', this.onAnchorBlur.bindAsEventListener( this ) );
        }
      }.bind( this ) );
    }

    // remove the context menu div from the page for performance reasons - add it back when we need to show it
    Element.remove( this.contextMenuDiv );
  },

  onKeyPress: function( event )
  {
    var elem, children, index;
    var key = event.keyCode || event.which;
    if ( key == Event.KEY_UP )
    {
      elem = Event.element ( event );
      children = this.contextMenuDiv.getElementsBySelector("li > a");
      index = children.indexOf( elem );
      if ( index > 0 )
      {
        children[index - 1].focus();
      }
      Event.stop( event );
    }
    else if ( key == Event.KEY_DOWN )
    {
      elem = Event.element ( event );
      children = this.contextMenuDiv.getElementsBySelector("li > a");
      index = children.indexOf( elem );
      if ( index < ( children.length - 1 ) )
      {
        children[index + 1].focus();
      }
      Event.stop( event );
    }
    else if ( key == Event.KEY_ESC )
    {
      this.close();
      this.displayContextMenuLink.focus();
      Event.stop( event );
    }
    else if ( key == Event.KEY_TAB )
    {
      elem = Event.element ( event );
      children = this.contextMenuDiv.getElementsBySelector("li > a");
      index = children.indexOf( elem );
      if ( (!event.shiftKey && index == children.length - 1) || (event.shiftKey && index === 0))
      {
        this.close();
        this.displayContextMenuLink.focus();
        Event.stop( event );
      }
    }
    else if ( key == Event.KEY_RETURN )
    {
      elem = Event.element ( event );
      (function() { page.util.fireClick( elem ); }.bind(this).defer());
      Event.stop( event );
    }
  },

  onAnchorFocus: function ( event )
  {
    Event.element( event ).setStyle({ backgroundColor: '#FFFFFF' });
  },

  onAnchorBlur: function( event )
  {
    Event.element( event ).setStyle({ backgroundColor: '' });
  },

  afterMenuGeneration: function( dynamicMenusCacheKey, showMenu, req )
  {
    if ( this.dynamicMenu )
    {
      var result;
      try
      {
        var contentMenuHTMLList;
        if( req )
        {
          result = req.responseText.evalJSON( true );
          if ( result && result.success == "true" )
          {
            contentMenuHTMLList = result.contentMenuHTMLList;
            page.ContextMenu.dynamicMenus.set(dynamicMenusCacheKey, contentMenuHTMLList)
          }
          else
          {
            new page.InlineConfirmation("error", result.errorMessage, false );
          }
        }
        else
        {
          contentMenuHTMLList = page.ContextMenu.dynamicMenus.get(dynamicMenusCacheKey);
        }
        if( contentMenuHTMLList )
        {
          // don't need to make the xhr call again unless this is a forceMenuRefresh type of context menu
          // its possible we're on mobile and contentMenuHTMLList is an empty string, so don't reset this.dynamicMenu unless we actually have menu results
          this.dynamicMenu =  this.forceMenuRefresh;

          // append uniqueId to each li
          var menuHTML = contentMenuHTMLList.replace(/(<li.*?id=")(.*?)(".*?>)/g,"$1$2_"+this.uniqueId+"$3");
          if ( this.forceMenuRefresh )
          {
             this.contextMenuDiv.innerHTML = this.originalContextMenuDiv.innerHTML;
          }
          this.contextMenuDiv.insert({bottom:menuHTML});
          $A(this.contextMenuDiv.getElementsByTagName("ul")).each( function( list, index )
          {
            list.id = 'cmul'+index+'_'+this.uniqueId;
          }.bind(this) );
          var contexMenuItems = this.contextMenuDiv.getElementsBySelector("li > a").each( function (link )
          {
            if ( !link.up('li').hasClassName("contextmenubar_top") )
            {
              Event.observe( link, 'focus', this.onAnchorFocus.bindAsEventListener( this ) );
              Event.observe( link, 'blur', this.onAnchorBlur.bindAsEventListener( this ) );
             }
          }.bind( this ) );
        }
      }
      catch ( e )
      {
         new page.InlineConfirmation("error", result.errorMessage, false );
      }
    }

    if( showMenu )
    {
      this.showMenu();
      //focus on the first menu item
      (function() { this.contextMenuDiv.down("a").focus(); }.bind(this).defer());
    }
    else
    {
      this.processEmptyGroupsAndEmptyMenu(this.hideContextMenuLink, this.showContextMenuLink);
    }
  },

  appendItems: function( items, menuItemContainer )
  {
    if (!menuItemContainer)
    {
      var uls = this.contextMenuDiv.getElementsBySelector("ul");
      menuItemContainer = uls[uls.length-1];
    }

    if (!items || !items.length)
    {
      return;
    }

    items.each( function ( item )
    {
      if ( item.type == "seperator" )
      {
        if (menuItemContainer.getElementsBySelector("li").length === 0)
        {
          return;
        }
        var ul = new Element('ul');
        menuItemContainer.parentNode.appendChild( ul );
        menuItemContainer = ul;
        return;
      }
      if ( !this.menuItemTempate )
      {
        var menuItems = this.contextMenuDiv.getElementsBySelector("li");
        this.menuItemTempate = menuItems[menuItems.length-1];
      }
      var mi = this.menuItemTempate.cloneNode( true );
      var a  =  mi.down('a');
      var name = item.key ? page.bundle.getString( item.key ) : item.name ? item.name : "?";
      a.update( name );
      a.title = item.title ? item.title : name;
      a.href = "#";
      menuItemContainer.appendChild( mi );
      Event.observe( a, 'focus', this.onAnchorFocus.bindAsEventListener( this ) );
      Event.observe( a, 'blur', this.onAnchorBlur.bindAsEventListener( this ) );
      Event.observe( a, 'click', this.onItemClick.bindAsEventListener( this, item.onclick, item.doNotSetFocusOnClick ) );
    }.bind( this ) );

  },

  onItemClick: function( evt, func, doNotSetFocusOnClick )
  {
    this.onCloseLinkClick( evt, doNotSetFocusOnClick );
    func();
  },

  setItems: function( items )
  {
    // rather than try to match up new items with existing items, it's easier to delete the existing items
    // (except for the close item) and then add the new items

    // remove existing menu items, except close menu
    var menuItems = this.contextMenuDiv.getElementsBySelector("li").each( function (li )
    {
      if ( !li.hasClassName("contextmenubar_top") )
      {
        if (!this.menuItemTempate)
        {
          this.menuItemTempate = li;
        }
        li.stopObserving();
        li.remove();
      }
    }.bind( this ) );

    // should only be one menuItemContainer
    var menuItemContainers = this.contextMenuDiv.getElementsBySelector("ul").each( function (ul)
    {
      if ( !ul.down("li") )
      {
        ul.remove();
      }
    }.bind( this ) );

    this.appendItems(items, menuItems[0].parentNode);
  },

  // hide context menu groups that has all of its menu items hidden.
  // All children A nodes OR all children LI nodes should be explicitly marked hidden for their parent node to get hidden
  // In other words, UL or LI element without any child node won't get hidden.
  // UL or LI element may have no child element at this time if they were to be inserted later. (ie. GC grid's cell context menu)
  processEmptyGroupsAndEmptyMenu : function(callBackOnEmptyMenu, callBackOnNonEmptyMenu)
  {
    var cmdiv = this.contextMenuDiv;
    var counter = {ul: 0, ulH: 0 /* hidden ul */, li: 0, liH: 0, as: 0 /* link (A node) or label (Span node) */, asH: 0};
    Array.prototype.slice.call(cmdiv.getElementsByTagName('ul')).each(function(ul) {
      // the contextmenubar always shows and it shouldn't be a factor in finding out whether there's any menu time to show or not
      // unless it's got siblings in the same menu group
      var firstLiChild = ul.down('li');
      if(!firstLiChild || (page.util.hasClassName(firstLiChild, 'contextmenubar_top')) && ul.childElementCount === 1) {
        return;
      }
      counter.ul += 1;
      counter.li = 0; //reset for this particular ul
      counter.liH = 0; //reset for this particular ul
      var isUlHidden = page.util.hasClassName(ul, 'cmul-hide');
      if (!isUlHidden) {
        Array.prototype.slice.call(ul.getElementsByTagName('li')).each(function(li) {
          var firstAChild = li.down('a');
          var labelMenuItems = li.childElements().grep(new Selector('span.labelMenuItem'));
          if(!firstAChild && labelMenuItems.size() < 1) {
            return;
          }
          counter.li += 1;
          counter.as = 0; //reset for this particular li
          counter.asH = 0; //reset for this particular li
          // Note that a hidden label item has 'cmitem-hide' set on LI node whereas a hidden non-label/link item has 'cmitem-hide' set on A node
          var isLiHidden = page.util.hasClassName(li, 'cmli-hide') || page.util.hasClassName(li, 'cmitem-hide') || page.util.hasClassName(li, 'contextmenubar_top');
          if (!isLiHidden) {
            Array.prototype.slice.call(li.getElementsByTagName('a')).each(function(a) {
              counter.as += 1;
              if (page.util.hasClassName(a, 'cmitem-hide')) {
                counter.asH += 1;
              }
            });
            Array.prototype.slice.call(labelMenuItems).each(function() {
              counter.as += 1;
            });
            if (counter.asH === counter.as) {
              // all the links and labels are hidden - hide the parent li
              li.addClassName('cmli-hide');
              isLiHidden = true;
            }
          }
          if (isLiHidden) {
            counter.liH += 1;
          }
        });
        // all the list items in the group(ul) are hidden - hide the group
        if (counter.liH === counter.li ) {
          ul.addClassName('cmul-hide');
          isUlHidden = true;
        }
      }
      if(isUlHidden) {
        counter.ulH += 1;
      }
    });
    if (counter.ulH === counter.ul) {
      // all the menu groups in the context menu other than the contextmenubar are hidden
      if( callBackOnEmptyMenu )
      {
        callBackOnEmptyMenu.apply(this);
      }
    }
    else
    {
      if( callBackOnNonEmptyMenu )
      {
        callBackOnNonEmptyMenu.apply(this);
      }
    }
  },

  createEmptyContextMenu : function()
  {
    var emptyContextMenuLI = this.contextMenuDiv.down(".contextmenu_empty");
    if( !emptyContextMenuLI )
    {
      // create a group and a list item to display an empty context menu with
      var ulElement = $(document.createElement("ul"));
      var liElement = $(document.createElement("li"));
      liElement.addClassName('contextmenu_empty');
      ulElement.setAttribute('role','presentation');
      ulElement.insert({bottom:liElement});
      this.contextMenuDiv.insertBefore(ulElement, this.contextMenuDiv.down(".contextmenubar_top").up('ul').nextSibling);
    }
  },

  removeEmptyContextMenu : function()
  {
    var emptyContextMenuLI = this.contextMenuDiv.down(".contextmenu_empty");
    if( emptyContextMenuLI )
    {
      emptyContextMenuLI.up('ul').remove();
    }
  },

  showMenu : function()
  {
    if (this.beforeShowFunc)
    {
      this.beforeShowFunc(this);
    }
    page.ContextMenu.registerContextMenu( this );
    this.reorderMenuItems();
    this.initARIA();

    // Note that this should be called after 'this.reorderMenuItems()' since the latter re-generate ul elements losing any property added to them
    this.processEmptyGroupsAndEmptyMenu(this.createEmptyContextMenu, this.showContextMenuLink);

    var offset = this.displayContextMenuLink.cumulativeOffset();
    var scrollOffset = this.displayContextMenuLink.cumulativeScrollOffset();
    var viewportScrollOffset = document.viewport.getScrollOffsets();
    if ( this.displayContextMenuLink.up( 'div.lb-content' ) )
    {
      // Fix offset for context menu link inside a lightbox
      offset[0] = offset[0] + viewportScrollOffset[0];
      offset[1] = offset[1] + viewportScrollOffset[1];
    }
    else
    {
      // Fix the offset if the item is in a scrolled container
      offset[0] = offset[0] - scrollOffset[0] + viewportScrollOffset[0];
      offset[1] = offset[1] - scrollOffset[1] + viewportScrollOffset[1];
    }
    document.body.appendChild( this.contextMenuDiv );
    this.contextMenuDiv.setStyle({display: "block"});
    var width = this.contextMenuDiv.getWidth();
    var bodyWidth = $(document.body).getWidth();

    if ( page.util.isRTL() )
    {
      offset[0] = offset[0] + this.displayContextMenuLink.getWidth() - width;
    }

    if ( offset[0] + width > bodyWidth )
    {
      offset[0] = offset[0] - width + 30;
    }

    if ( this.keepMenuToRight )
    {
      // In case the link is very wide (i.e. gradecenter accessible mode cell link for really wide cell)
      // make sure the menu renders to the right side of the link
      var linkWidth = this.displayContextMenuLink.getDimensions().width;
      if (linkWidth > width)
      {
        // Only worry if the link is actually wider than the menu
        offset[0] += (linkWidth-width);
      }
    }

    // Don't start the menu off the left side of the window
    if ( offset[0] < 0 )
    {
      offset[0] = 0;
    }

    var height = this.contextMenuDiv.getHeight();
    var bodyHeight = $(document.body).getHeight();
    if (bodyHeight === 0)
    {
      // TODO This is kindof a hack since body height == 0 on a stream page, but we hacked in a special case for
      // lb-content above so it isn't entirely unheard of... would just be nicer to make this bodyheight choice
      // determined by the calling page rather than trial and error...
      var streamDiv = this.displayContextMenuLink.up( 'div.stream_full' );
      if (streamDiv)
      {
        bodyHeight = streamDiv.getHeight();
      }
    }
    var ypos = offset[1] + this.displayContextMenuLink.getHeight() + 17;
    if ( ( height + ypos ) > bodyHeight )
    {
      ypos -= height;
      ypos -= 34;
    }
    // Don't start the menu off the top of the screen
    if (ypos < 0 )
    {
      ypos = 0;
    }
    if (height > bodyHeight)
    {
      // If the menu is too big to fit on the screen, set it to the height of the screen and allow scrollbars inside the menu
      this.contextMenuDiv.setStyle({ height: bodyHeight + "px", overflowY: "auto", overflowX: "hidden", left: offset[0] + "px", top: ypos + "px" });
    }
    else
    {
      this.contextMenuDiv.setStyle({ left: offset[0] + "px", top: ypos + "px"});
    }
    if ( !this.shim )
    {
      this.shim = new page.popupShim( this.contextMenuDiv );
    }
    this.shim.open();
  },

  initARIA: function()
  {
    if ( !this.initializedARIA )
    {
      this.displayContextMenuLink.setAttribute( "aria-haspopup", "true" );
      // If the button is already set with role="button", don't overwrite it.
      if ( 'button' !== this.displayContextMenuLink.getAttribute('role') )
      {
        this.displayContextMenuLink.setAttribute( "role", "menubutton" );
      }
      this.contextMenuDiv.down( "ul" ).setAttribute( "role", "menu" );
      $A( this.contextMenuDiv.getElementsByTagName('a') ).each ( function( link )
      {
        if( !link.hasClassName("close-menu") ) {
          link.setAttribute( "role", "menuitem" );
          link.parentNode.setAttribute( "role", "presentation" );
        }
        if ( !link.href.include("#") )
        {
          Event.observe( link, 'click', function() {
            if ( this.ohref.toLowerCase().startsWith("javascript") )
            {
              eval( decodeURIComponent(this.ohref) );
            }
            else
            {
              if ( this.target )
              {
                window.open( this.ohref, this.target );
              }
              else
              {
                window.location = this.ohref;
              }
            }
          } );
          link.ohref = link.href;
          link.removeAttribute( "href" );
          link.tabIndex = "0";
          link.setStyle( {cursor: 'pointer'} ); // make it look like a link.
        }
      });
      this.initializedARIA = true; // Only initialize once.
    }
  },

  reorderMenuItems : function()
  {
    if ( !this.menuOrder || this.menuOrder.length < 2 )
    {
      return;
    }

    var orderMap = {};
    var closeItem = null;
    var extraItems = [];  // items not in order

    // Gather up all of the <li> tags in the menu and stick them in a map/object of id to the li object
    $A(this.contextMenuDiv.getElementsByTagName("li")).each( function( listItem )
    {
      if (listItem.hasClassName("contextmenubar_top"))
      {
        closeItem = listItem;
      }
      else
      {
        if (this.menuOrder.indexOf(listItem.id) > -1)
        {
          orderMap[listItem.id] = listItem;  // add item to map
        }
        else
        {
          extraItems.push(listItem); // listItem id not specified in menuOrder, so add listItem to extraItems
        }
      }
    }.bind(this) );

    // Remove all the content from the context menu div
    $A(this.contextMenuDiv.getElementsByTagName("ul")).each( function( list )
    {
      Element.remove(list);
    }.bind(this) );

    // Re-add the special "close" item as the first item.
    var ulElement = $(document.createElement("ul"));
    ulElement.setAttribute('role','presentation');
    this.contextMenuDiv.insert({bottom:ulElement});
    ulElement.insert({bottom:closeItem});

    // Loop through the order, adding a <ul> at the start, and starting a new <ul> whenever a "*separator*"
    //  is encountered, and adding the corresponding <li> for each of the ids in the order using the map/object
    this.menuOrder.each( function( id )
    {
      if (id == "*separator*")
      {
        ulElement = $(document.createElement("ul"));
        ulElement.setAttribute('role','presentation');
        this.contextMenuDiv.insert({bottom:ulElement});
      }
      else
      {
        ulElement.insert({bottom:orderMap[id]});
      }
    }.bind(this) );


    // Add any extraItems to thier own ul
    if (extraItems.length > 0)
    {
      ulElement = $(document.createElement("ul"));
      ulElement.setAttribute('role','presentation');
      this.contextMenuDiv.insert({bottom:ulElement});
      extraItems.each( function( lineItem )
      {
        ulElement.insert({bottom:lineItem});
      }.bind(this) );
    }

    // Remove any empty ULs and ensure that the added <ul>s have id of form "cmul${num}_${uniqueId}"
    $A(this.contextMenuDiv.getElementsByTagName("ul")).findAll( function( list )
    {
      if ( list.childElements().length === 0 )
      {
        list.remove(); return false;
      }
      else
      {
        return true;
      }
    }).each( function( list, index )
    {
      list.id = 'cmul'+index+'_'+this.uniqueId;
    }.bind(this) );
  },

  processDynamicMenu : function()
  {
    if (this.dynamicMenu)
    {
      page.ContextMenu.closeAllContextMenus();
      this.generateDynamicMenuHelper(this.afterMenuGeneration, false);
    }
  },

  showContextMenuLink : function()
  {
    page.ContextMenu.showContextMenuLink(this.displayContextMenuLink);
  },

  hideContextMenuLink : function()
  {
    page.ContextMenu.hideContextMenuLink(this.displayContextMenuLink);
  },

  generateDynamicMenu : function(event)
  {
    page.ContextMenu.closeAllContextMenus();
    if (this.dynamicMenu)
    {
      this.generateDynamicMenuHelper(this.afterMenuGeneration, true);
    }
    else
    {
      this.afterMenuGeneration.call(this, null, true);
    }
    $(event).preventDefault();
  },

  generateDynamicMenuHelper : function(callBackOnSuccess, showMenu)
  {
    var context_parameters = this.contextParameters;
    var menu_generator_url = this.menuGeneratorURL;
    var nav = this.nav;
    var overwriteNavItems = this.overwriteNavItems;

    if ( context_parameters )
    {
      context_parameters = context_parameters.toQueryParams();
    }
    else
    {
      context_parameters = {};
    }

    var params = Object.extend({nav_item: nav }, context_parameters );
    params = Object.extend( params, { overwriteNavItems : overwriteNavItems } );

    var dynamicMenusCacheKey = menu_generator_url + JSON.stringify( params );
    if ( undefined !== page.ContextMenu.dynamicMenus.get(dynamicMenusCacheKey) )
    {
      this.afterMenuGeneration.call(this, dynamicMenusCacheKey, showMenu);
    }
    else
    {
      // on mobile the onClick and onFocus/onMouseOver events happen at the same time. To prevent two ajax calls to the
      // menu_generator_url add an empty string to the dynamicMenu cache. Upstream methods close open menus, so this
      // will be 'rendered' by the afterMenuGeneration call but not won't change anything because its an empty string
      page.ContextMenu.dynamicMenus.set(dynamicMenusCacheKey, "");

      new Ajax.Request(menu_generator_url,
      {
        method: 'post',
        parameters: params,
        onSuccess: callBackOnSuccess.bind( this, dynamicMenusCacheKey, showMenu ),
        onFailure: function(e) { page.ContextMenu.dynamicMenus.set( undefined ); } // reset in case of error
      });
    }
  },

  onDisplayLinkClick: function( event )
  {
    page.ContextMenu.closeAllContextMenus();
    if (this.dynamicMenu)
    {
     this.generateDynamicMenu(event);
    }
    else
    {
      this.showMenu();
      //focus on the first menu item
      (function() { if (this.contextMenuDiv.style.display != 'none') { this.contextMenuDiv.down("a").focus(); } }.bind(this).defer());
      $(event).preventDefault();
    }
  },

  onCloseLinkClick: function( event, doNotSetFocusOnClick )
  {
    this.close();

    var setFocusOnDisplayContextMenuLink = true;

    // grade center (in non-accessible mode) hides displayContextMenuLink onMouseOut, so we need to make sure it's doNotSetFocusOnClose flag is not set
    // before setting focus.
    if ( this.displayContextMenuLink.doNotSetFocusOnClose !== undefined && this.displayContextMenuLink.doNotSetFocusOnClose )
    {
      setFocusOnDisplayContextMenuLink = false;
    }

    // We may not want to set focus on displayContextMenuLink when one of the menu items (other than Close Menu) is clicked.
    // Initially this behavior was required for Grade Center Quick Comment of a grade in the grid (see getGradeContextMenuItems function in gradebookgrid_cellctrl.js)
    if ( doNotSetFocusOnClick !== undefined && doNotSetFocusOnClick )
    {
      setFocusOnDisplayContextMenuLink = false;
    }

    if ( setFocusOnDisplayContextMenuLink )
    {
      this.displayContextMenuLink.focus();
    }
    if (event)
    {
    Event.stop( event );
    }
  },

  close: function()
  {
    // Delay the removal of the element from the page so firefox will continue to process
    // the click on the menu item chosen (otherwise it stops processing as soon as we remove the
    // element resulting in the menu not actually working)
    (function() {
      this.closeNow();
    }.bind(this).delay(0.1));
  },

  closeNow: function()
  {
    if (this.contextMenuDiv.style.display != "none")
    {
      var links = this.contextMenuDiv.getElementsBySelector("li > a");
      links.each(function(link) {
        link.blur();
      });
      this.contextMenuDiv.style.display = "none";
      Element.remove( this.contextMenuDiv );
      if ( this.shim )
      {
        this.shim.close();
      }
    }
  }
};
/**
 * Function called to change the 'arrow' of a breadcrumb to face downward when they are clicked for the
 * contextual menu.
 * @param uniqId - unique number which identifies the crumb which was clicked
 * @param size - the size of the breadcrumb
 * @return
 */
page.ContextMenu.changeArrowInBreadcrumb = function (uniqId, event)
{

  page.ContextMenu.alignArrowsInBreadcrumb(event);
  $('arrowContext_'+uniqId).addClassName('contextArrowDown').removeClassName('contextArrow');
  //Stop the click event to propagate anymore -else all arrows will be aligned again
  Event.stop( event );
  return false;
};

//To align all breadcrumb arrows in one direction
page.ContextMenu.alignArrowsInBreadcrumb = function (event)
{
  if ($('breadcrumbs') !== null){
    var bList = $($('breadcrumbs').getElementsByTagName('ol')[0]);
    var bs = bList.immediateDescendants();
    if (bs.length !== null && bs.length >1){
      for (var i = 2; i <= bs.length; i++) {
        var arrowSpan = $('arrowContext_'+i);
        if (arrowSpan !== null ){
          $('arrowContext_'+i).addClassName('contextArrow').removeClassName('contextArrowDown');
        }
      }
    }
  }

  return false;
};

// "static" methods
page.ContextMenu.LI = function(event, divId, forceMenuRefresh)
{
  page.LazyInit(event,['focus','mouseover'],'new page.ContextMenu(page.util.upToClass(target,\'contextMenuContainer\'), \'' + divId + '\',' + forceMenuRefresh + ');');
};
page.ContextMenu.dynamicMenus = $H()
page.ContextMenu.contextMenus = []; // _Open_ context menus
page.ContextMenu.registerContextMenu = function( menu )
{
  page.ContextMenu.contextMenus.push( menu );
};
page.ContextMenu.hiddenDivs = $H(); // All the menu divs on the page - only needed for cases such as view_spreadsheet2.js where we try to modify the menus outside this framework
page.ContextMenu.hideMenuDiv = function( uniqueId, firstInsideInventoryCard)
{
  var linkId = 'cmlink_' + uniqueId;
  var link = document.getElementById(linkId);
  if (link && !link.savedDiv ) {
    element = page.ContextMenu.locateMenuDiv( link, uniqueId );
    if (element)
    {
      link.savedDiv = element;
      page.ContextMenu.hiddenDivs.set(uniqueId,element);
      Element.remove( element );
      if (firstInsideInventoryCard)
      {
        var theCard = page.util.upToClass(link, 'block');
        if (theCard)
        {
          var menuSpanToMove = page.util.upToClass(link,'contextMenuContainer inlineMenuItems');
          if (menuSpanToMove)
          {
            menuSpanToMove.style.display='inline';
            theCard.insert({bottom:menuSpanToMove});
          }
        }
      }
    }
  }
};
/*
 * This takes in contextMenuDiv or any element inside contextMenuDiv (div element with 'cmdiv_{uniqueId}' as its id) and
 * make necessary changes to show the element in DOM including its container(s) and the link to the context menu.
 */
page.ContextMenu.showContextMenuAndLink = function(elem)
{
  var menuItem;
  var menuGroup;
  var menuDiv;
  if(elem.hasClassName('cmdiv'))
  {
    menuDiv = elem;
    Array.prototype.slice.call(menuDiv.getElementsByTagName('ul')).each(function(menuGroup) {
      menuGroup.removeClassName('cmul-hide');
      Array.prototype.slice.call(menuGroup.getElementsByTagName('li')).each(function(menuItem) {
        $j(menuItem).removeClass('cmli-hide cmitem-hide');
        Array.prototype.slice.call(menuItem.getElementsByTagName('a')).each(function(menuItemLink) {
          menuItemLink.removeClassName('cmitem-hide');
        });
      });
    });
  }
  else
  {
    var elemTagNameUpperCase = elem.tagName.toUpperCase()
    if("UL" === elemTagNameUpperCase)
    {
      menuGroup = elem;
      Array.prototype.slice.call(menuGroup.getElementsByTagName('li')).each(function(menuItem) {
        $j(menuItem).removeClass('cmli-hide cmitem-hide');
        Array.prototype.slice.call(menuItem.getElementsByTagName('a')).each(function(menuItemLink) {
          menuItemLink.removeClassName('cmitem-hide');
        });
      });
    }
    else
    {
      if("A" === elemTagNameUpperCase)
      {
        menuItem = elem.up('li');
        elem.removeClassName('cmitem-hide');
      }
      else if("SPAN" === elemTagNameUpperCase)
      {
        menuItem = elem.up('li');
      }
      else if("LI" === elemTagNameUpperCase)
      {
        menuItem = elem;
        Array.prototype.slice.call(menuItem.getElementsByTagName('a')).each(function(menuItemLink) {
          menuItemLink.removeClassName('cmitem-hide');
        });
      }
      else
      {
        return;
      }
      $j(menuItem).removeClass('cmli-hide cmitem-hide');
      menuGroup = menuItem.up('ul');
    }
    menuGroup.removeClassName('cmul-hide');
    menuDiv = page.util.upToClass(menuGroup,'cmdiv');
  }

  var emptyMenuItem = menuDiv.down(".contextmenu_empty");
  if(emptyMenuItem)
  {
    emptyMenuItem.up('ul').remove();
  }
  page.ContextMenu.updateContextMenuLinkVisibility(menuDiv, true)
};
/*
 * This takes in contextMenuDiv or any element inside contextMenuDiv (div element with 'cmdiv_{uniqueId}' as its id) and
 * update the visibility of the (context menu) link that's for the menu
 */
page.ContextMenu.updateContextMenuLinkVisibility = function(elem, isShow)
{
  var ctxMenuLink = page.ContextMenu.locateMenuLink(elem);
  if(ctxMenuLink)
  {
    if(isShow)
    {
      page.ContextMenu.showContextMenuLink(ctxMenuLink);
    }
    else
    {
      page.ContextMenu.hideContextMenuLink(ctxMenuLink);
    }
  }
};
/*
 * This takes in contextMenuDiv or any element inside contextMenuDiv (div element with 'cmdiv_{uniqueId}' as its id) and
 * locate its corresponding context menu link in DOM
 */
page.ContextMenu.locateMenuLink = function(elem)
{
  var ctxMenuDiv;
  if(elem.hasClassName('cmdiv'))
  {
    ctxMenuDiv = elem;
  }
  else
  {
    ctxMenuDiv = page.util.upToClass(elem,'cmdiv');
  }
  var uniqueId = ctxMenuDiv.id.split('_')[1];
  return $('cmlink_'+uniqueId);
};
page.ContextMenu.hideContextMenuLink = function(link)
{
  if( link && page.util.hasClassName(link, 'cmimg') )
  {
    link.addClassName('cmimg-hide');
  }
};
page.ContextMenu.showContextMenuLink = function(link)
{
  if( link && page.util.hasClassName(link, 'cmimg') )
  {
    link.removeClassName('cmimg-hide');
  }
};
page.ContextMenu.locateMenuDiv = function( link, uniqueId )
{
  var elementId = 'cmdiv_' + uniqueId;
  var element = link.nextSibling; // Should be the text between the link and div but check anyways
  if ( !element || element.id != elementId )
  {
    element = element.nextSibling;
    if ( !element || element.id != elementId)
    {
      element = document.getElementById(elementId);
    }
  }
  return element;
};
page.ContextMenu.addDivs = function()
{
  $H(page.ContextMenu.hiddenDivs).values().each(function(ele)
  {
    document.body.appendChild(ele);
  });
};

page.ContextMenu.removeDivs = function()
{
  $H(page.ContextMenu.hiddenDivs).values().each(function(ele)
  {
    Element.remove(ele);
  });
};

page.ContextMenu.closeAllContextMenus = function( event )
{
  var deferClose = false;
  if ( event )
  {
    var e = Event.findElement( event, 'a' );
    if ( e && e.href.indexOf("#contextMenu") >= 0 )
    {
      Event.stop( event );
      return;
    }
    deferClose = true;
  }

  page.ContextMenu.contextMenus.each( function( menu )
  {
    if ( menu != this )
    {
      if (deferClose) {
        menu.close();
      } else {
        menu.closeNow();
      }
    }
  });
  page.ContextMenu.contextMenus = [];
};

/**
 *  Enables flyout menus to be opened using a keyboard or mouse.  Enables
 *  them to be viewed properly in IE as well.
 */
page.FlyoutMenu = Class.create();
page.FlyoutMenu.prototype =
{
  initialize: function( subMenuListItem )
  {
    if ( !Event.KEY_SPACE )
    {
      Event.KEY_SPACE = 32;
    }

    this.subMenuListItem = $(subMenuListItem);
    // LRN-149616 Menus should use button instead of anchor tag to open the menu.
    // If a button is not found, fall back to searching for an anchor tag.
    this.menuLink = $(subMenuListItem.getElementsBySelector('> button')[0]);
    if (!this.menuLink)
    {
      this.menuLink = $(subMenuListItem.getElementsByTagName('a')[0]);
    }
    //special case to render iframe shim under new course content build menu
    if (this.subMenuListItem.hasClassName('bcContent'))
    {
      var buildContentDiv = this.subMenuListItem.down("div.flyout");
      if ( !buildContentDiv )
      {
        this.subMenu = $(subMenuListItem.getElementsByTagName('ul')[0]);
      }
      else
      {
        this.subMenu = buildContentDiv;
      }
    }
    else
    {
      this.subMenu = $(subMenuListItem.getElementsByTagName('ul')[0]);
    }
    this.menuLink.flyoutMenu = this;

    // calculate the next/previous tab stops
    this.previousSibling = this.subMenuListItem.previous();
    while ( this.previousSibling && (!this.previousSibling.down('a') || !this.previousSibling.visible()) )
    {
      this.previousSibling = this.previousSibling.previous();
    }
    this.nextSibling = this.subMenuListItem.next();
    while ( this.nextSibling && (!this.nextSibling.down('a') || !this.nextSibling.visible()) )
    {
      this.nextSibling = this.nextSibling.next();
    }

    var rumble = $(this.subMenuListItem.parentNode.parentNode);
    this.inListActionBar = rumble && ( rumble.hasClassName("rumble_top") || rumble.hasClassName("rumble") );

    Event.observe( this.menuLink, 'mouseover', this.onOpen.bindAsEventListener( this ) );
    Event.observe( subMenuListItem, 'mouseout', this.onClose.bindAsEventListener( this ) );
    Event.observe( this.menuLink, 'click', this.onLinkOpen.bindAsEventListener( this ) );
    Event.observe( this.subMenuListItem, 'keydown', this.onKeyPress.bindAsEventListener( this ) );

    $A( this.subMenu.getElementsByTagName('li') ).each ( function( li )
    {
      $A(li.getElementsByTagName('a')).each( function( link )
      {
        Event.observe( link, 'focus', this.onAnchorFocus.bindAsEventListener( this ) );
        Event.observe( link, 'blur', this.onAnchorBlur.bindAsEventListener( this ) );
        Event.observe( link, 'click', this.onLinkClick.bindAsEventListener( this, link ) );
      }.bind( this ) );
    }.bind( this ) );

    this.initARIA();
    this.enabled = true;
  },

  initARIA: function()
  {
    var inListActionBar = this.inListActionBar;
    if ( inListActionBar )
    {
      this.subMenuListItem.up('ul').setAttribute( "role", "menubar" );
    }
    this.subMenuListItem.setAttribute( "role", "presentation" );
    this.subMenu.setAttribute( "role", "menu" );
    this.subMenu.setAttribute( "aria-hidden", "true" );
    if ( !this.menuLink.hasClassName("notMenuLabel") )
    {
      this.menuLink.setAttribute( "aria-expanded", "false" );
      this.menuLink.setAttribute( "aria-haspopup", "true" );
      this.menuLink.setAttribute( "aria-controls", this.subMenu.id );
      this.menuLink.setAttribute( "role", "button" );
      this.subMenu.setAttribute( "aria-labelledby", this.menuLink.id );
    }
    $A( this.subMenu.getElementsByTagName('a') ).each ( function( link )
    {
      link.setAttribute( "role", "menuitem" );
      link.parentNode.setAttribute( "role", "presentation" );
      if ( !link.parentNode.hasClassName("current") )
      {
        link.setAttribute( "tabindex", "-1" );
      }
      else
      {
        link.setAttribute( "tabindex", "0" );
      }
      // List action bars have onclick handlers that prevent submission of the page
      // if no items are selected, so we can't register new onclicks here because
      // otherwise we can't stop them from executing.
      if ( !inListActionBar )
      {
        if ( !link.href.include("#") )
        {
          Event.observe( link, 'click', function() {
            if ( this.ohref.toLowerCase().startsWith("javascript") )
            {
              eval(decodeURIComponent(this.ohref) );
            }
            else
            {
              if ( this.target )
              {
                window.open( this.ohref, this.target );
              }
              else
              {
                window.location = this.ohref;
              }
            }
          } );
          link.ohref = link.href;
          link.removeAttribute( "href" );
          link.tabIndex = "-1";
          link.style.cursor = 'pointer'; // make it look like a link.
        }
      }
    });

  },

  setEnabled: function( enabled )
  {
    this.enabled = enabled;
    if ( !enabled )
    {
      this.subMenu.setStyle({ display: '' });
    }
  },

  onKeyPress: function( event )
  {
    if (!this.enabled)
    {
      return;
    }
    var key = event.keyCode || event.which;
    var elem = Event.element ( event );
    var children, index, link;
    if ( key == Event.KEY_UP )
    {
      children = this.subMenu.getElementsBySelector("li > a");
      index = children.indexOf( elem );
      if ( index > 0 )
      {
        children[index - 1].focus();
      }
      else if ( index === 0 )
      {
        children[children.length - 1].focus(); // wrap to bottom
      }
      Event.stop( event );
    }
    else if ( key == Event.KEY_DOWN )
    {
      children = this.subMenu.getElementsBySelector("li > a");
      index = children.indexOf( elem );
      if ( index == -1 )
      {
        this.open();
       (function() { this.subMenu.down("li > a").focus(); }.bind(this).defer());
      }
      else if ( index < ( children.length - 1 ) )
      {
        children[index + 1].focus();
      }
      else if ( index == ( children.length - 1 ) )
      {
        children[0].focus(); // wrap to top
      }

      Event.stop( event );
    }
    else if ( key == Event.KEY_LEFT )
    {
      if ( !this.previousSibling || ( this.previousSibling.hasClassName("mainButton") ||
                                  this.previousSibling.hasClassName("mainButtonType") ) )
      {
        this.executeTab( event, true, true );
      }
      else if ( this.previousSibling )
      {
        link = this.previousSibling.getElementsByTagName('a')[0];
        if ( !link || !this.previousSibling.hasClassName("sub") )
        {
          return;
        }
        this.close();
        page.util.fireClick( link );
        Event.stop( event );
      }
    }
    else if ( key == Event.KEY_RIGHT )
    {
      if ( !this.nextSibling || ( this.nextSibling.hasClassName("mainButton") ||
                              this.nextSibling.hasClassName("mainButtonType") ) )
      {
        this.executeTab( event, true, false );
      }
      else if ( this.nextSibling )
      {
        link = this.nextSibling.getElementsByTagName('a')[0];
        if ( !link || !this.nextSibling.hasClassName("sub") )
        {
          return;
        }
        this.close();
        page.util.fireClick( link );
        Event.stop( event );
      }
    }
    else if ( key == Event.KEY_ESC )
    {
      this.close();
      this.menuLink.focus();
      Event.stop( event );
    }
    else if ( (key == Event.KEY_RETURN || key == Event.KEY_SPACE) && !this.inListActionBar )
    {
      page.util.fireClick( elem );
      Event.stop( event );
    }
    else if ( key == Event.KEY_TAB )
    {
      this.executeTab( event, false, event.shiftKey );
    }
  },

  executeTab: function( event, forceMenuLinkTab, shift )
  {
    var elem = Event.element ( event );
    var link;
    if ( ( elem != this.menuLink ) || forceMenuLinkTab )
    {
      if ( shift )
      {
        // Go to previous menu
        if ( this.previousSibling )
        {
          link = this.previousSibling.getElementsByTagName('a')[0];
          if ( link ) { link.focus(); } else { this.menuLink.focus(); }
        }
        else
        {
          this.menuLink.focus();
        }
      }
      else
      {
        // Go to next menu
        if ( this.nextSibling )
        {
          link = this.nextSibling.getElementsByTagName('a')[0];
          if ( link ) { link.focus(); } else { this.menuLink.focus(); }
        }
        else
        {
          this.menuLink.focus();
        }
      }

      this.close();
      Event.stop( event );
    }
  },

  onOpen: function( event )
  {
    if (!this.enabled)
    {
      return;
    }
    this.open();
  },

  onClose: function( event )
  {
    var to = $(event.relatedTarget || event.toElement);
    if ( !to || to.up('li.sub') != this.subMenuListItem )
    {
      this.close();
    }
  },

  onLinkOpen: function( event )
  {
    if (!this.enabled)
    {
      return;
    }
    this.open();
    (function() { this.subMenu.down("li > a").focus(); }.bind(this).defer());
    Event.stop( event );
  },

  onToggle: function( event )
  {
    if (!this.enabled)
    {
      return;
    }
    var alreadyShown = this.subMenu.getStyle('display') === 'block';
    if ( alreadyShown )
    {
        this.close();
    }
    else
    {
        this.open();
    }
    Event.stop( event );
  },

  resizeAfterShowHide: function()
  {
  // TODO - ideally this would just resize the outer div, but closing and opening 'works'
  this.close();
  this.open();
  },

  open: function()
  {
    var alreadyShown = this.subMenu.getStyle('display') === 'block';
    // If the menu is already showing (i.e. as_ce4 theme, we don't need to position it)
    if ( !alreadyShown )
    {
      // Set position of action bar elements to static to enable z-index stack order
      page.util.setActionBarPosition( 'static' );

      var menuTop = this.subMenuListItem.getHeight();
      if ( this.subMenu.hasClassName( 'narrow' ) )
      {
        menuTop = 0;
      }
      this.subMenuListItem.setStyle( {position: 'relative'} );
      this.subMenu.setAttribute( "aria-hidden", "false" );
      this.menuLink.setAttribute( "aria-expanded", "true" );
      this.subMenu.setStyle(
      {
        display: 'block',
        zIndex: '999999',
        top: menuTop+'px',
        left: '0px',
        width: '',
        height: '',
        overflowY: ''
      });
      var offset = Position.cumulativeOffset( this.subMenuListItem );
      var menuDims = this.subMenu.getDimensionsEx();
      var menuHeight = menuDims.height;
      var popupWidth = this.subMenu.getWidth();
      var subListItemDims = this.subMenuListItem.getDimensions();
      var menuWidth = subListItemDims.width;

      var viewportDimensions = document.viewport.getDimensions();
      var scrollOffsets = document.viewport.getScrollOffsets();
      var gnav = $('globalNavPageNavArea');
      var gnavHeight = 0;
      if (window.self === window.top) {
        if (gnav)
        {
          var gdim = gnav.getDimensions()
          gnavHeight = gdim.height;
        }
        viewportDimensions.height -= gnavHeight;
        var gnavContent = $('globalNavPageContentArea');
        var gnavScroll = 0;

        if (gnavContent)
        {
          gnavScroll = gnavContent.scrollTop;
        }
        scrollOffsets.top += gnavScroll;

        var offsetTop = offset[1] - scrollOffsets.top - gnavHeight;
      }
      this.subMenu.flyoutMenu = this;

      if ( (offsetTop + menuHeight + subListItemDims.height) > viewportDimensions.height)
      {
        if ( (offsetTop - menuHeight) > 0 )
        {
          // if menu goes below viewport but still fits on-page, show it above button
          this.subMenu.setStyle({ top: '-'+menuHeight+'px' });
        }
        else
        {
          // we need to create scrollbars
          var newWidth = this.subMenu.getWidth() + 15;
          popupWidth = newWidth + 5;
          var newMenuHeight = viewportDimensions.height - (offsetTop + subListItemDims.height) - 20;
          var newMenuTop = menuTop;
          if (newMenuHeight < offsetTop)
          {
            // More space above than below
            newMenuHeight = offsetTop;
            newMenuTop = -offsetTop;
          }
          this.subMenu.setStyle(
                                {
                                  display: 'block',
                                  zIndex: '999999',
                                  top: newMenuTop+'px',
                                  left: '0px',
                                  width: newWidth + 'px',
                                  height: newMenuHeight + 'px',
                                  overflowY: 'auto'
                                });
        }
      }

      var offsetLeft = offset[0] - scrollOffsets.left;
      if ( (offsetLeft + popupWidth) > viewportDimensions.width )
      {
        var subMenuWidth = this.subMenuListItem.getWidth();
        var newLeft = popupWidth - (viewportDimensions.width-offsetLeft);
        if ((newLeft > 0) && (newLeft < offsetLeft))
        {
          newLeft = -newLeft;
        }
        else
        {
          newLeft = -offsetLeft;
        }
        this.subMenu.setStyle({ left: newLeft+'px' });
      }

      if ( page.util.isRTL() )
      {
        var newRight = 0;
        if ( (offsetLeft + menuWidth) - popupWidth < 0 )
        {
          newRight = (offsetLeft + menuWidth) - popupWidth;
        }
        this.subMenu.setStyle({ left: '', right: newRight+'px'});
      }

      if (!this.shim)
      {
        this.shim = new page.popupShim( this.subMenu);
      }

      this.shim.open();
    }
  },

  close: function()
  {
    // Reset position of action bar elements to relative
    page.util.setActionBarPosition( 'relative' );

    this.menuLink.blur();
    this.subMenuListItem.setStyle({position: ''});
    this.subMenu.setAttribute( "aria-hidden", "true" );
    this.menuLink.setAttribute( "aria-expanded", "false" );
    this.subMenu.setStyle({
      display: '',
      top: '',
      left: '',
      width: '',
      height: '',
      overflowY: ''
    });
    if ( this.shim )
    {
      this.shim.close();
    }
  },

  onLinkClick: function( event, link )
  {
    if (!this.enabled)
    {
      return;
    }
    setTimeout( this.blurLink.bind( this, link), 100);
  },

  blurLink: function( link )
  {
    link.blur();
    if (page.util.hasClassName( link, "donotclose" ))
    {
      link.focus();
    }
    else
    {
      this.close();
    }

  },

  onAnchorFocus: function ( event )
  {
    if (!this.enabled)
    {
      return;
    }
    var link = Event.element( event );
    link.setStyle({ backgroundColor: '#FFFFFF' });
  },

  onAnchorBlur: function( event )
  {
    var link = Event.element( event );
    link.setStyle({ backgroundColor: '' });
  }
};

/**
 * Class for providing functionality to menu palettes
 */
page.PaletteController = Class.create();
page.PaletteController.prototype =
{
  /**
   * Constructor
   *
   * @param paletteIdStr        Unique string identifier for a palette
   * @param expandCollapseIdStr Id value of anchor tag to be assigned
   *                            the palette expand/collapse functionality
   * @param closeOtherPalettesWhenOpen Whether to close all other palettes when this one is open
   */
  initialize: function( paletteIdStr, expandCollapseIdStr, closeOtherPalettesWhenOpen, collapsed )
  {
    // palette id string
    this.paletteItemStr = paletteIdStr;

    // palette element
    this.paletteItem = $(this.paletteItemStr);

    // default id string to palette contents container element
    this.defaultContentsContainerId = page.PaletteController.getDefaultContentsContainerId(this.paletteItemStr);

    // the currently active palette contents container element
    this.activeContentsContainer = $(this.defaultContentsContainerId);

    // expand/collapse palette toggle element
    this.paletteToggle = $(expandCollapseIdStr);

    if (this.paletteToggle)
    {
      Event.observe(this.paletteToggle, 'click', this.toggleExpandCollapsePalette.bindAsEventListener(this));
    }

    this.closeOtherPalettesWhenOpen = closeOtherPalettesWhenOpen;

    page.PaletteController.registerPaletteBox(this);
    if (collapsed)
    {
      this.collapsePalette(true);
    }
  },

  /**
   * Set the currently active palette contents container element
   *
   * @param container palette contents container element
   */
  setActiveContentsContainer: function ( container )
  {
    this.activeContentsContainer = container;
  },

  /**
   * Get the currently active palette contents container element
   *
   * @return palette contents container element
   */
  getActiveContentsContainer: function ()
  {
    return this.activeContentsContainer;
  },

  /**
   * Expands the palette if it's not already expanded.
   *
   * @return palette contents container element
   */
  expandPalette: function ( doNotPersist )
  {
    var itemPalClass = [];
    itemPalClass = this.paletteItem.className.split(" ");

    var h2 = $(this.paletteItemStr+"_paletteTitleHeading");
    var expandCollapseLink = h2.getElementsByTagName('a')[0];
    if ( !this.useFirstTagForExpandCollapse( h2 ) )
    {
      expandCollapseLink = h2.getElementsByTagName('a')[1];
    }

    var itemList = this.activeContentsContainer;

    if ( itemList.style.display == "none" )
    {
      itemList.style.display = "block";
      itemPalClass.length = itemPalClass.length - 1;
      this.paletteItem.className = itemPalClass.join(" ");
      h2.className = "";
      var itemTitle = expandCollapseLink.innerHTML.stripTags().trim();
      if ( !this.useFirstTagForExpandCollapse( h2 ) )
      {
        itemTitle = h2.getElementsByTagName('a')[0].innerHTML.stripTags();
      }
      expandCollapseLink.title = page.bundle.getString('expandCollapse.collapse.section.param', itemTitle);
      expandCollapseLink.setAttribute("aria-expanded", "true");
    }

    if ( doNotPersist )
    {
      return;
    }

    this.saveSessionStickyInfo( itemList.id, itemList.style.display );
  },

  /**
   * Collapses the palette if it's not already collapsed.
   *
   * @return palette contents container element
   */
  collapsePalette: function ( doNotPersist )
  {
    var itemPalClass = [];
    itemPalClass = this.paletteItem.className.split(" ");

    // Note - h2 is actually a div, not an h2 :)
    var h2 = $(this.paletteItemStr+"_paletteTitleHeading");
    var expandCollapseLink = h2.getElementsByTagName('a')[0];
    if ( !this.useFirstTagForExpandCollapse( h2 ) )
    {
      expandCollapseLink = h2.getElementsByTagName('a')[1];
    }

    var itemList = this.activeContentsContainer;

    if ( itemList.style.display != "none" )
    {
      itemList.style.display = "none";
      itemPalClass[itemPalClass.length] = 'navPaletteCol';
      this.paletteItem.className = itemPalClass.join(" ");

      if (itemPalClass.indexOf('controlpanel') != -1)
      {
      }

      if (itemPalClass.indexOf('listCm')!=-1)
      {
        h2.className = "listCmCol"; // colors h2 background (removes background image)
      }

      if (itemPalClass.indexOf('tools') != -1)
      {
        h2.className = "toolsCol";
      }
      var itemTitle = expandCollapseLink.innerHTML.stripTags();
      if ( !this.useFirstTagForExpandCollapse( h2 ) )
      {
        itemTitle = h2.getElementsByTagName('a')[0].innerHTML.stripTags().trim();
      }
      expandCollapseLink.title = page.bundle.getString('expandCollapse.expand.section.param', itemTitle);
      expandCollapseLink.setAttribute("aria-expanded", "false");
    }

    if (doNotPersist)
    {
      return;
    }

    this.saveSessionStickyInfo( itemList.id, itemList.style.display );
  },

  /**
   * Takes in a key value pair to save to the session as sticky data.
   *
   * @param key The key that will have the current course id appended to it to be saved to the session.
   * @param value The value to the key.
   */
  saveSessionStickyInfo: function( key, value )
  {
    /* Get the course id off of the global variable if exists, so that data is saved per
     * user session per course. If course doesn't exist, use empty string.
     */
    var current_course_id = window.course_id ? window.course_id : "";
    ClientCache.setItem( key + current_course_id, value );
  },

  /**
   * Whether the first tag has js onclick event binding on it for palette collapse/expand
   *
   * @param h2
   */
  useFirstTagForExpandCollapse: function ( h2 )
  {
    return h2.getElementsByTagName('a')[0].id.indexOf( "noneExpandCollapseTag" ) > -1 ? false : true;
  },

  /**
   * Toggles a palette from expand to collapse and vice versa.
   *
   * @param event Optional event object if this method was bound to event.
   */
  toggleExpandCollapsePalette: function ( event, doNotPersist )
  {
    // To prevent default event behavior
    if ( event )
    {
      Event.stop( event );
    }

    if ( this.activeContentsContainer.style.display == "none" )
    {
      // palette is currently closed, so we will be expanding it
      if ( this.closeOtherPalettesWhenOpen )
      {
        // if closeOtherPalettesWhenOpen is set to true for this palette, close all other palettes
        page.PaletteController.closeAllOtherPalettes(this.paletteItemStr, doNotPersist);
      }
      this.expandPalette( doNotPersist );
    }
    else
    {
      // palette is currently expanded, so we will be collapsing it
      this.collapsePalette( doNotPersist );
    }
  }
};

// "static" methods

page.PaletteController.paletteBoxes = [];
page.PaletteController.registerPaletteBox = function( paletteBox )
{
  page.PaletteController.paletteBoxes.push( paletteBox );
};

/**
 * Get the palette controller js object by palette id
 *
 * @param paletteId
 */
page.PaletteController.getPaletteControllerObjById = function( paletteId )
{
  return page.PaletteController.paletteBoxes.find( function( pb )
         { return ( pb.paletteItemStr == paletteId ); } );
};


/**
 * Closes all palettes except the specified one
 *
 * @param paletteToKeepOpen
 */
page.PaletteController.closeAllOtherPalettes = function( paletteToKeepOpen, doNotPersist )
{
  for(var i = 0; i < page.PaletteController.paletteBoxes.length; i++)
  {
    var paletteItem = page.PaletteController.paletteBoxes[i];
    if (paletteToKeepOpen !== paletteItem.paletteItemStr)
    {
      paletteItem.collapsePalette( doNotPersist );
    }
  }
};

/**
 * Toggles (expand/collapse) the contents of a nav palette by palette id
 *
 * @param paletteId
 * @param doNotPersist - optional param to suppress persisting state, default is to persist
 */
page.PaletteController.toggleExpandCollapsePalette = function( paletteId, doNotPersist )
{
  var paletteObj = page.PaletteController.getPaletteControllerObjById( paletteId );
  paletteObj.toggleExpandCollapsePalette( null, doNotPersist);
};


/**
 * Collapses the contents of a nav palette by palette id
 *
 * @param paletteId
 * @param doNotPersist - optional param to suppress persisting state, default is to persist
 */
page.PaletteController.collapsePalette = function( paletteId, doNotPersist )
{
  var paletteObj = page.PaletteController.getPaletteControllerObjById( paletteId );
  paletteObj.collapsePalette( doNotPersist);
};


/**
 * Expand the contents of a nav palette by palette id
 *
 * @param paletteId
 * @param doNotPersist - optional param to suppress persisting state, default is to persist
 */
page.PaletteController.expandPalette = function( paletteId, doNotPersist )
{
  var paletteObj = page.PaletteController.getPaletteControllerObjById( paletteId );
  paletteObj.expandPalette( doNotPersist);
};


/**
 * Set the active palette contents container (element containing the body
 * contents of a palette). The active contents container is used to toggle
 * visibility when expanding and collapsing menu palettes.
 *
 * @param paletteId
 * @param paletteContentsContainer Optional container to set.
 *                                 If not given, the palette's active
 *                                 container will not be changed.
 * @return The new active palette contents container element.
 *         If no paletteContentsContainer element was passed,
 *         The current active palette contents container element
 *         will be returned.
 */
page.PaletteController.setActivePaletteContentsContainer = function( paletteId, paletteContentsContainer )
{
  var paletteObj = page.PaletteController.getPaletteControllerObjById( paletteId );
  if ( paletteContentsContainer )
  {
    paletteObj.setActiveContentsContainer( paletteContentsContainer );
  }
  return paletteObj.getActiveContentsContainer();
};

/*
 * Get the default palette contents container id string
 *
 * @param paletteId
 */
page.PaletteController.getDefaultContentsContainerId = function( paletteId )
{
  return paletteId + "_contents";
};


/**
 * Class for providing expand/collapse functionality (with dynamic loading)
 */
page.ItemExpander = Class.create();
page.ItemExpander.prototype =
{
  /**
   * Constructor
   * - expandLink - the link that when clicked will expand/collapse the item
   * - expandArea - the actual area that will get expanded/collapsed (if the item is dynamically loaded, this area will be populated dynamically)
   * - expandText - the text to show as a tooltip on the link for expanding
   * - collapseText - the text to show as a tooltip on the link for collapsing
   * - expandTitleText - the customized text for link title afer expanding the item; if null/undefined, use expandText
   * - collapseTitleText - the customized text for link title after collapsing the item;if null/undefined, use collapseText
   * - dynamic - whether the contents are dynamically loaded
   * - dynamicUrl - the URL to get the contents of the item from
   * - contextParameters - additional URL parameters to add when calling the dynamicUrl
   * - sticky - load/save expand state from UserData; true if null/undefined
   * - expanded - initially expanded; false if null/undefined
   * - useClientCache - if true, lookup the state from ClientCache instead of userdatadwrfacade
   */
  initialize: function( expandLink, expandArea, expandText, collapseText, dynamic, dynamicUrl, contextParameters, expandTitleText, collapseTitleText, sticky, expanded, useClientCache )
  {
    this.expandLink = $(expandLink);
    this.expandArea = $s(expandArea);
    // Register the expander so it can be found
    page.ItemExpander.itemExpanderMap[this.expandLink.id] = this;
    this.expandText = expandText.unescapeHTML();
    this.collapseText = collapseText.unescapeHTML();
    if ( expandTitleText !== null && expandTitleText !== undefined )
    {
      this.expandTitleText = expandTitleText.unescapeHTML();
    }
    else
    {
      this.expandTitleText = this.expandText;
    }
    if ( collapseTitleText !== null && collapseTitleText !== undefined )
    {
      this.collapseTitleText = collapseTitleText.unescapeHTML();
    }
    else
    {
      this.collapseTitleText = this.collapseText;
    }
    this.dynamic = dynamic;
    this.dynamicUrl = dynamicUrl;

    if ( contextParameters !== null && contextParameters !== undefined )
    {
      this.contextParameters = contextParameters.toQueryParams();
    }
    else
    {
      this.contextParameters = {};
    }

    this.sticky = ( sticky !== null && sticky !== undefined ) ? sticky : true;
    this.expanded = ( expanded !== null && expanded !== undefined ) ? expanded : false;
    this.useClientCache = ( useClientCache !== null && useClientCache !== undefined ) ? useClientCache : false;
    this.hasContents = !this.dynamic;

    if ( this.sticky )
    {
      // get the course id off of the global variable if exists, because data is saved per user session per course
      var current_course_id = ( ( typeof course_id != "undefined" ) && course_id !== null ) ? course_id : "";
      if ( this.useClientCache )
      {
        this.getAvailableResponse( ClientCache.getItem( this.expandLink.id + current_course_id ) );
      }
      else
      {
        UserDataDWRFacade.getStringTempScope( this.expandLink.id + current_course_id,
          this.getAvailableResponse.bind( this ) );
      }
    }
    this.expandCollapse( !this.expanded );
    Event.observe( this.expandLink, "click", this.onToggleClick.bindAsEventListener( this ) );
  },

  getAvailableResponse : function ( response  )
  {
    var originalExpanded = this.expanded ;
    var cachedExpanded = false;
    if ( response && response.length > 0 )
    {
      if ( response == 'true' )
      {
        cachedExpanded = true;
      }
      else
      {
        cachedExpanded = false;
      }
    }

    if ( originalExpanded != cachedExpanded )
    {
      //because we want the menu to be in the cached state,
      //we pass in the opposite so that expandCollapse changes the menu state.
      this.expandCollapse(originalExpanded);
    }
  },

  onToggleClick: function( event )
  {
    if ( event )
    {
      Event.stop( event );
    }

    this.expandCollapse(this.expanded);

    if ( this.sticky )
    {
      // get the course id off of the global variable if exists, so that data is saved per user session per course
      var current_course_id = ( (typeof course_id != "undefined") && course_id !== null ) ? course_id : "";
      if ( this.useClientCache )
      {
        ClientCache.setItem( this.expandLink.id + current_course_id, this.expanded );
      }
      else
      {
        UserDataDWRFacade.setStringTempScope( this.expandLink.id + current_course_id, this.expanded );
      }
    }
  },

  expandCollapse: function(shouldCollapse)
  {
    var combo;
    if ( shouldCollapse ) //Collapse the item
    {
      $(this.expandArea).hide();
      this.expandLink.title = this.expandTitleText;
      this.expandLink.setAttribute("aria-expanded", "false");
      if ( this.expandLink.hasClassName("comboLink_active") )
      {
        combo = this.expandLink.up("li").down(".submenuLink_active");
        this.expandLink.removeClassName("comboLink_active");
        this.expandLink.addClassName("comboLink");
        if ( combo )
        {
          combo.removeClassName("submenuLink_active");
          combo.addClassName("submenuLink");
        }
      }
      else
      {
        this.expandLink.removeClassName("open");
      }
      this.expanded = false;
    }
    else //Expand the item
    {
      if ( this.hasContents )
      {
        $(this.expandArea).setStyle({ zoom: 1 });
        this.expandArea.show();
        this.expandLink.title = this.collapseTitleText;
        this.expandLink.setAttribute("aria-expanded", "true");
        if ( this.expandLink.hasClassName("comboLink") )
        {
          combo = this.expandLink.up("li").down(".submenuLink");
          this.expandLink.removeClassName("comboLink");
          this.expandLink.addClassName("comboLink_active");
          if ( combo )
          {
            combo.removeClassName("submenuLink");
            combo.addClassName("submenuLink_active");
          }
        }
        else
        {
          this.expandLink.addClassName("open");
        }
      }
      else if ( this.dynamic )
      {
        this.loadData();
      }

      this.expanded = true;
    }
  },

  loadData: function()
  {
    new Ajax.Request( this.dynamicUrl,
    {
      method: "post",
      parameters: this.contextParameters,
      onSuccess: this.afterLoadData.bind( this )
    });
  },

  afterLoadData: function( req )
  {
    try
    {
      var result = req.responseText.evalJSON( true );
      if ( result.success != "true" )
      {
        new page.InlineConfirmation("error", result.errorMessage, false );
      }
      else
      {
        this.hasContents = true;
        this.expandArea.innerHTML = result.itemContents;
        $(this.expandArea).setStyle({ zoom: 1 });
        this.expandArea.show();
        this.expandLink.title = this.collapseTitleText;
        this.expandLink.setAttribute("aria-expanded", "true");
        if ( this.expandLink.hasClassName("comboLink") )
        {
          var combo = this.expandLink.up("li").down(".submenuLink");
          this.expandLink.removeClassName("comboLink");
          this.expandLink.addClassName("comboLink_active");
          if ( combo )
          {
            combo.removeClassName("submenuLink");
            combo.addClassName("submenuLink_active");
          }
        }
        else
        {
          this.expandLink.addClassName("open");
        }
        this.expanded = true;
      }
    }
    catch ( e )
    {
      //Invalid response
    }
  }
};
page.ItemExpander.itemExpanderMap = {};

/**
 * Class for controlling the "breadcrumb expansion" (i.e. the "..." hiding the inner
 * breadcrumbs)
 */
page.BreadcrumbExpander = Class.create();
page.BreadcrumbExpander.prototype =
{
  initialize: function( breadcrumbBar )
  {
    var breadcrumbListElement = $(breadcrumbBar.getElementsByTagName('ol')[0]);
    var breadcrumbs = breadcrumbListElement.immediateDescendants();
    if ( breadcrumbs.length > 4 )
    {
      this.ellipsis = document.createElement("li");
      var ellipsisLink = document.createElement("a");
      ellipsisLink.setAttribute("href", "#");
      ellipsisLink.setAttribute("title", page.bundle.getString('breadcrumbs.expand') );
      ellipsisLink.innerHTML = "...";
      this.ellipsis.appendChild( ellipsisLink );
      this.ellipsis = Element.extend( this.ellipsis );
      Event.observe( ellipsisLink, "click", this.onEllipsisClick.bindAsEventListener( this ) );
      this.hiddenItems = $A(breadcrumbs.slice(2,breadcrumbs.length - 2));
      breadcrumbListElement.insertBefore( this.ellipsis, this.hiddenItems[0] );
      this.hiddenItems.invoke( "hide" );
    }

    // Make sure the breadcrumbs don't run into the mode switcher
    var breadcrumbContainer = $(breadcrumbListElement.parentNode);
    var modeSwitcher = breadcrumbBar.down('.modeSwitchWrap');
    if ( modeSwitcher )
    {
      var containerWidth = breadcrumbContainer.getWidth();
      var containerOffset = breadcrumbContainer.cumulativeOffset();
      var modeSwitcherOffset = modeSwitcher.cumulativeOffset();
      var modeSwitcherWidth = modeSwitcher.getWidth();
      if ( page.util.isRTL() )
      {
        if ( modeSwitcherOffset[0] + modeSwitcherWidth > containerOffset[0] )
        {
          breadcrumbContainer.setStyle({ paddingLeft: ( modeSwitcherOffset[0] + modeSwitcherWidth ) + 'px'} );
        }
      }
     // else
      //{
       // breadcrumbContainer.setStyle({ paddingRight: ( containerWidth - ( modeSwitcherOffset[0] - containerOffset[0] ) ) + 'px'} );
      //}
    }
  },

  onEllipsisClick: function( event )
  {
    this.hiddenItems.invoke( "show" );
    this.ellipsis.hide();
    Event.stop( event );
  }
};

page.getCssClassByType = function ( type )
{
  var cssClass = "bad";
  if ( type === "success" )
  {
    cssClass = "good";
  }
  else if ( type === "warning" )
  {
    cssClass = "warningReceipt";
  }
  else if ( type === "adding" )
  {
    cssClass = "adding";
  }
  else if ( type === "removing" )
  {
    cssClass = "removing";
  }
  return cssClass;
}

/**
 * Dynamically creates an inline confirmation.
 *
 * refreshMessage - if we allow only one receipt on the page, refresh the message; even if we display only one instance
 * of message on the page, we can change the content of the message
 */
page.InlineConfirmation = Class.create();
page.InlineConfirmation.prototype =
{
  initialize: function( type, message, showRefreshLink, oneReceiptPerPage, refreshMessage, focusOnRender )
  {
    if ( Object.isUndefined( focusOnRender ) )
    {
      focusOnRender = true;
    }
    var receiptId = $s('receipt_id');
    // do not insert a duplicate receipt, if one already exists
    if( receiptId && oneReceiptPerPage )
    {
      if( !refreshMessage )
      {
        return;
      }
      else
      {
        var receiptDivElement = $( receiptId );
        receiptDivElement.parentNode.removeChild( receiptDivElement );
      }
    }
    var cssClass = page.getCssClassByType(type);
    var contentPane = $('contentPanel') || $('portalPane');
    var receiptHtml = '<div id="receipt_id" class="receipt '+ cssClass +'">'+
                      '<span class="inlineReceiptSpan" tabindex="-1">'+message+'</span>';
    if ( showRefreshLink )
    {
      receiptHtml += ' <a href="#refresh" onClick="document.location.href = document.location.href; return false;">' + page.bundle.getString("inlineconfirmation.refresh") + '</a>';
    }
    receiptHtml += '<a class="close" href="#close" title="'+ page.bundle.getString("inlineconfirmation.close") +'" onClick="Element.remove( $(this).up(\'div.receipt\') ); return false;"><img alt="'+ page.bundle.getString("inlineconfirmation.close") +'" src="' + getCdnURL( "/images/ci/ng/close_mini.gif" ) + '"></a></div>';
    contentPane.insert({top:receiptHtml});
    // use aria live region to announce this confirmation message rather than setting focus to it. (Too many things are fighting over setting focus)
    // Note: if this confirmation is invoked from a menu handler, it may not announce if focus is lost when the menu closes. See how courseTheme.js sets focus before invoking.
    var insertedA = contentPane.down('span.inlineReceiptSpan');
    insertedA.setAttribute("aria-live","assertive");
    insertedA.parentNode.setAttribute("role","application");
    (function() { insertedA.update( insertedA.innerHTML ); }.defer(2));  // update live region so it is announced

    if( focusOnRender )
    {
      page.util.focusAndScroll( insertedA );
    }
  }
};

page.NestedInlineConfirmationIdCounter = 0;
page.NestedInlineConfirmation = Class.create();
page.NestedInlineConfirmation.prototype =
{
  initialize: function( type, message, showRefreshLink, previousElement,showCloseLink, extracss, insertBefore, oneReceiptPerPage, fadeAway, focusDiv, fadingTime, insertTop, receiptDivId, focusOnRender, additionalArrowCss )
  {
    new page.NestedInlineConfirmationEx({
      type : type,
      message : message,
      showRefreshLink : showRefreshLink,
      previousElement : previousElement,
      showCloseLink : showCloseLink,
      extracss : (extracss) ? extracss : "",
      insertBefore : insertBefore,
      oneReceiptPerPage : oneReceiptPerPage,
      fadeAway : fadeAway,
      focusDiv : focusDiv,
      fadingTime : fadingTime,
      insertTop : insertTop,
      receiptDivId : receiptDivId,
      focusOnRender : focusOnRender,
      additionalArrowCss : additionalArrowCss});
  }
};

page.NestedInlineConfirmationEx = Class.create();
page.NestedInlineConfirmationEx.prototype =
{
  initialize: function( options )
  {
    this.options = Object.extend(
                                 {
                                     type : null,
                                     message : null,
                                     showRefreshLink : null,
                                     previousElement: null,
                                     showCloseLink : null,
                                     extracss: "",
                                     insertBefore: null,
                                     oneReceiptPerPage: null,
                                     fadeAway : null,
                                     focusDiv : null,
                                     fadingTime: null,
                                     insertTop: null,
                                     receiptDivId : null,
                                     focusOnRender : true,
                                     axOnly : false,
                                     additionalArrowCss: ""
                                 }, options );

   var receiptId = $s('receipt_nested_id');
    // do not insert a duplicate receipt, if one already exists
   var newDivId = 'receipt_nested_id';
    if(receiptId)
    {
      if (this.options.oneReceiptPerPage)
      {
        return;
      }
      newDivId = newDivId + (page.NestedInlineConfirmationIdCounter++);
    }

    // if receiptDivId is provided, we are explicitly using it as the id for the new receipt replacing the existing receipt with the same id
    if (this.options.receiptDivId)
    {
      // Remove the old message with the same receiptDivId if there is one before adding a new one
      if ( $( this.options.receiptDivId ) != null )
      {
        $( this.options.receiptDivId ).remove();
      }
      newDivId = this.options.receiptDivId;
    }

    var cssClass = page.getCssClassByType(this.options.type);

    if ( this.options.axOnly )
    {
      cssClass = cssClass + ' hideoff';

      //overrides a few options explicitly for our purpose of using the receipt only for AX
      this.options.fadeAway = true;
      this.options.showCloseLink = false;
    }

    var arrowSpan = '';
    if (this.options.extracss.indexOf( "point", 0 ) != -1)
    {
      if ( this.options.additionalArrowCss )
      {
        arrowSpan = '<span class="arrow" style="' +  this.options.additionalArrowCss + '"></span>';
      } else {
        arrowSpan = '<span class="arrow"></span>';
      }
    }

    var contentPane = $(this.options.previousElement);
    if (!contentPane)
    {
      // TODO - if we can't find the element we wanted to insert before, is it OK to just drop the notification?
      return;
    }

    var receiptHtml = '<div id="'+newDivId+'" style="display:none" class="receipt '+ cssClass +' '+this.options.extracss +'">'+arrowSpan+
                      '<span class="inlineReceiptSpan areceipt" tabindex="-1">'+this.options.message+'</span>';
    if ( this.options.showRefreshLink )
    {
      receiptHtml += ' <a href="#refresh" onClick="document.location.href = document.location.href; return false;">' + page.bundle.getString("inlineconfirmation.refresh") + '</a>';
    }

    if (this.options.showCloseLink)
    {
      // either this is a JS Snippet to execute on close or a simple true in which case we do nothing extra
      var onCloseFunction = "";
      if ( typeof this.options.showCloseLink === "string" || this.options.showCloseLink instanceof String )
      {
        if ( !page.closeReceiptLinkCounter )
        {
          page.closeReceiptLinkCounter = 0;
        }
        else
        {
          ++page.closeReceiptLinkCounter;
        }
        onCloseFunction = "onReceiptClosed" + page.closeReceiptLinkCounter;
        receiptHtml += "<script type='text/javascript'>window." + onCloseFunction + " = function( ) { " + this.options.showCloseLink + " ; }; </script>";
        onCloseFunction += "( );";
      }
      receiptHtml += '<a class="close" href="#close" style="z-index:1000" title="' + page.bundle.getString("inlineconfirmation.close") + '" onClick="' + onCloseFunction + 'Element.remove( $(this).up(\'div.receipt\') ); return false;"><img alt="' + page.bundle.getString("inlineconfirmation.close") + '" src="' + getCdnURL( "/images/ci/ng/close_mini.gif" ) + '"></a></div>';
    }

    if ( this.options.insertBefore )
    {
      contentPane.insert({before:receiptHtml});
    }
    else if (this.options.insertTop)
    {
      contentPane.insert({top:receiptHtml});
    }
    else
    {
      contentPane.insert({after:receiptHtml});
    }
    this.insertedDiv = this.options.insertBefore?contentPane.previousSibling:(this.options.insertTop?contentPane.firstChild:contentPane.nextSibling);
    $(this.insertedDiv).show();
    var insertedA = $(this.insertedDiv).down('span.inlineReceiptSpan');
    var fadingDuration = this.options.fadingTime ? this.options.fadingTime : 5000;

    // For all cases (focus or not), set the aria assertive attribute to make sure this is announced by the screen reader
    insertedA.setAttribute("aria-live","assertive");
    this.insertedDiv.setAttribute("role","application");
    (function() { insertedA.update( insertedA.innerHTML ); }.defer(2));  // update live region so it is announced (needed for jaws 12)

    if ( this.options.focusOnRender )
    {
        try
        {
         ( function()
            {
           try
           {
              if ( this.options.focusDiv )
              {
                page.util.focusAndScroll( $( this.options.focusDiv ) );
              }
              else
              {
                page.util.focusAndScroll( insertedA );
              }
           }
           catch ( focusError )
           {
             // Ignore focus errors. These can happens sometimes on IE if focus is set on an element that is located
             // inside another element that has recently been switched from a hidden state to a visible one.
           }

            }.defer() );
        }
        catch ( focusError )
        {
          // Ignore focus errors. These can happens sometimes on IE if focus is set on an element that is located
          // inside another element that has recently been switched from a hidden state to a visible one.
        }
    }
    else
    {
        // not setting focus to this confirmation - but still make sure it is visible.
        if ( this.options.focusDiv )
        {
          page.util.ensureVisible( $( this.options.focusDiv ) );
        }
        else
        {
          page.util.ensureVisible( insertedA );
        }
    }
    if ( this.options.fadeAway )
    {
      setTimeout( function()
      {
        Element.fade( $(this.insertedDiv),
        {
          duration : 0.3
        } );
      }.bind(this), fadingDuration );
    }
  },

  close: function()
  {
    if ( this.insertedDiv )
    {
      this.insertedDiv.remove();
    }
  }
};


/**
* Dynamically creates a Floating confirmation.
* This floating confirmation is a control that its position depends of the referenced element,
* Its width depends of the message, and its attached directly to the body of the page.
*
* type - It defines the css class to be used, that is determined by getCssClassByType.
* message - the text to display
* referencedElementId - the id of the element that this confirmation will take as reference to be showed.
* verticalPosition - Vertically the confirmation could be displayed on: top, bottom, middle, top-inside and bottom-inside, of the referenced element.
* horizontalPosition - Horizontally the confirmation could be displayed on: left, right, center, left-inside and right-inside, of the referenced element.
* focusBackElementId - after close the confirmation where the focus should be redirected.
*/
page.FloatingConfirmation = Class.create();
page.FloatingConfirmation.prototype =
{
  initialize: function ( type, message, referencedElementId, verticalPosition, horizontalPosition, focusBackElementId )
  {
    page.removeFloatingConfirmation();

    let divContainer = document.createElement( 'div' );
    divContainer.setAttribute( "id", 'floating_receipt' );
    divContainer.className = "miniReceipt " + page.getCssClassByType( type );
    divContainer.style.position = "absolute";
    divContainer.style.whiteSpace = "nowrap";
    divContainer.style.padding = "1px";
    divContainer.setAttribute( "aria-describedby", 'floating_receipt_description' );
    divContainer.setAttribute( "aria-modal", 'true' );
    divContainer.setAttribute( "role", 'alertdialog' );

    let spanMessage = document.createElement( 'span' );
    spanMessage.innerText = message;
    spanMessage.tabIndex = -1;
    spanMessage.className = "inlineReceiptSpan";
    spanMessage.setAttribute( "id", 'floating_receipt_description' );


    let closeButton = document.createElement( 'button' );
    closeButton.className = "btn-with-img";
    closeButton.title = page.bundle.getString("inlineconfirmation.close");
    closeButton.setAttribute( "arial-label", page.bundle.getString("inlineconfirmation.close"));
    closeButton.addEventListener( "click", function ()
    {
      page.removeFloatingConfirmation();
      if ( focusBackElementId )
      {
        page.util.focusAndScroll( $( focusBackElementId ) );
      }
    }, false );

    let closeImage = document.createElement( 'img' );
    closeImage.alt = page.bundle.getString("inlineconfirmation.close");
    closeImage.src = getCdnURL( "/images/ci/ng/close_mini.gif" );
    closeImage.style.width = "13px";

    closeButton.appendChild( closeImage );
    divContainer.appendChild( spanMessage );
    divContainer.appendChild( closeButton );
    document.body.appendChild( divContainer );

    let referencedElement = $( referencedElementId );
    if ( referencedElement )
    {
      this.setConfirmationPosition( divContainer, referencedElement, verticalPosition, horizontalPosition );
    }

    page.util.focusAndScroll( spanMessage );
  },

  setConfirmationPosition: function ( divContainer, referencedElement, verticalPosition, horizontalPosition )
  {
    let referenceOffSet = Element.viewportOffset(referencedElement);
    referenceOffSet.top = referenceOffSet.top + document.viewport.getScrollOffsets().top;
    referenceOffSet.left = referenceOffSet.left + document.viewport.getScrollOffsets().left;

    divContainer.style.top = ( referenceOffSet.top- divContainer.offsetHeight ) + "px";
    if ( verticalPosition && verticalPosition === "bottom" )
    {
      divContainer.style.top = ( referenceOffSet.top+ referencedElement.offsetHeight ) + "px";
    }
    else if ( verticalPosition && referencedElement === "middle" )
    {
      divContainer.style.top = ( referenceOffSet.top+ ( referencedElement.offsetHeight / 2 ) - ( divContainer.offsetHeight / 2 ) ) + "px";
    }
    else if ( verticalPosition && verticalPosition === "top-inside" )
    {
      divContainer.style.top = referenceOffSet.top+ "px";
    }
    else if ( verticalPosition && verticalPosition === "bottom-inside" )
    {
      divContainer.style.top = ( referenceOffSet.top+ referencedElement.offsetHeight - divContainer.offsetHeight ) + "px";
    }

    if ( page.util.isRTL() )
    {
      if ( horizontalPosition === "left" )
      {
        horizontalPosition = "right";
      }
      else if ( horizontalPosition === "right" )
      {
        horizontalPosition = "left";
      }
      else if ( horizontalPosition === "left-inside" )
      {
        horizontalPosition = "right-inside";
      }
      else if ( horizontalPosition === "right-inside" )
      {
        horizontalPosition = "left-inside";
      }
    }

    divContainer.style.left = ( referenceOffSet.left - divContainer.offsetWidth ) + "px";
    if ( horizontalPosition && horizontalPosition === "right" )
    {
      divContainer.style.left = ( referenceOffSet.left + referencedElement.offsetWidth ) + "px";
    }
    else if ( horizontalPosition && horizontalPosition === "center" )
    {
      divContainer.style.left = ( referenceOffSet.left + ( referencedElement.offsetWidth / 2 ) - ( divContainer.offsetWidth / 2 ) ) + "px";
    }
    else if ( horizontalPosition && horizontalPosition === "left-inside" )
    {
      divContainer.style.left = referenceOffSet.left + "px";
    }
    else if ( horizontalPosition && horizontalPosition === "right-inside" )
    {
      divContainer.style.left = ( referenceOffSet.left + referencedElement.offsetWidth - divContainer.offsetWidth ) + "px";
    }
  }
};

page.removeFloatingConfirmation = function ()
{
  var oldFloatingConfirmation = $( "floating_receipt" );
  if ( oldFloatingConfirmation )
  {
    Element.remove( oldFloatingConfirmation );
  }
}

page.NestedInlineFadeAwayConfirmation = Class.create();
page.NestedInlineFadeAwayConfirmation.prototype =
{
  initialize: function( type, message, showRefreshLink, element,showCloseLink, insertBefore, time  )
  {
    var fadingDuration = time ? time : 2000;
    new page.NestedInlineConfirmation(type, message, showRefreshLink, element,showCloseLink, "", insertBefore, null, true, null, fadingDuration );
  }
};

page.NestedInlineFadeAwaySingleConfirmation = Class.create();
page.NestedInlineFadeAwaySingleConfirmation.prototype =
{
  initialize: function( type, message, showRefreshLink, element,showCloseLink, insertBefore, time, newDivId, insertTop )
  {
    var fadingDuration = time ? time : 2000;
    new page.NestedInlineConfirmation(type, message, showRefreshLink, element,showCloseLink, "", insertBefore, false /*only one instance*/, true, null, fadingDuration, insertTop, newDivId );
  }
};

/**
 * Make sure the container as position: relative so that the offset can work
 */
page.MiniReceipt = Class.create();
page.MiniReceipt.prototype =
{
    initialize: function( message, containerElement, top, left, time )
    {
      var visibleDuration = time ? time : 2000;
      var top = top?top:-22; // usually show receipt above
      var left = left?left:0;
      var alreadyExistingReceipt = $( containerElement ).down( "div.miniReceipt" );
      if  ( alreadyExistingReceipt )
      {
        alreadyExistingReceipt.hide( );
      }
      var receiptHtml = '<div class="miniReceipt adding" style="display: none; top:' + top + 'px; left:'+ left + 'px" role="alert" aria-live="assertive">' + message + '</div>';
      var receiptElement = $( containerElement ).insert( { top:receiptHtml } ).firstDescendant( );
      $( containerElement ).select();
      receiptElement.show( );
      setTimeout(
        function()
        {
          Element.fade( receiptElement, {duration:0.3, afterFinish: function() { receiptElement.remove(); } } );
        }, visibleDuration );
    }
};

page.extendedHelp = function( helpattributes, windowName )
{
  window.helpwin = window.open('/webapps/blackboard/execute/viewExtendedHelp?' +
               helpattributes,windowName,'menubar=1,resizable=1,scrollbars=1,status=1,width=480,height=600');
  window.helpwin.focus();
};

page.decoratePageBanner = function()
{
  var bannerDiv = $('pageBanner');
  // TODO: review this logic - we used to actually add a style to containerDiv but
  // we do not need it anymore - does the pagetitlediv hiding depend on containerdiv existing?  probably, so leaving
  var containerDiv = $('contentPanel') || $('contentPane');
  if ( bannerDiv && containerDiv )
  {
    // hide empty title bar
    if ( !$('pageTitleText') && $('pageTitleDiv') )
    {
      $('pageTitleDiv').hide();
    }
  }
};

page.initializeSinglePopupPage = function( pageId )
{
  // Initialize the single popup page, make sure the window will be closed by clicking submit or cancel, and the parent
  // window will be refreshed after submit.
  var items = document.forms;
  for ( var i = 0; i < items.length; i++ )
  {
    var formItem = items[ i ];
    formItem.observe( 'submit', function()
    {
       (function()
       {
         window.close();
         if( window.opener.refreshConfirm )
         {
            window.opener.refreshConfirm(pageId);
         }
       }.defer());
    } );
    //TODO: Delete the reference to top_Cancel after floating bottom submit proven works.
    if ( formItem.top_Cancel )
    {
      Event.observe( formItem.top_Cancel, 'click', function( event )
      {
        Event.stop( event );
        window.close();
      } );
    }
    if ( formItem.bottom_Cancel )
    {

      Event.observe( formItem.bottom_Cancel, 'click', function( event )
      {
        Event.stop( event );
        window.close();
      } );
    }
  }
};

page.openLightbox = function( link, title, url, width, height )
{
  var lightboxParam =
  {
      defaultDimensions :
      {
          w : width ? width : 1100,
          h : height ? height : 800
      },
      contents : '<iframe src="' + url + '" width="100%" height="100%"/>',
      title : title,
      closeOnBodyClick : false,
      showCloseLink : true,
      useDefaultDimensionsAsMinimumSize : true
  };
  var lightboxInstance = new lightbox.Lightbox( lightboxParam );
  lightboxInstance.open();
};

page.printAndClose = function()
{
  (function() {
    window.print();
    window.close();
  }.defer());
};

/**
 * Utility for data collection step manipulation
 */
page.steps = {};
page.steps.HIDE = "hide";
page.steps.SHOW = "show";

/**
 * Hide or show an array of steps given the step ids and
 * renumber all visible steps on the page.
 *
 * @param action - either page.steps.HIDE or page.steps.SHOW
 * @param stepIdArr - string array of step ids
 */
page.steps.hideShowAndRenumber = function ( action, stepIdArr )
{
  // hide or show each of the step ids given
  ($A(stepIdArr)).each( function( stepId )
  {
      page.steps.hideShow( action, stepId );
  });

  // get all H3 elements that contain css class of "steptitle"
  var stepTitleTags = [];
  $A(document.getElementsByTagName('h3')).each( function( tag )
  {
    if ( page.util.hasClassName( tag, 'steptitle' ) )
    {
      stepTitleTags.push( $(tag) );
    }
  });

  // starting at number 1, renumber all of the visible steps
  var number = 1;
  stepTitleTags.each(function( stepTitleTag )
  {
    if ( stepTitleTag.up('div').visible() )
    {
      stepTitleTag.down('span').update(number);
      number++;
    }
  });
};

/**
 * Hide or show a single step given the step id.
 *
 * @param action - either page.steps.HIDE or page.steps.SHOW
 * @param stepId - string identifier to a single step
 */
page.steps.hideShow = function ( action, stepId )
{
  if ( action == page.steps.SHOW )
  {
    $(stepId).show();
  }
  else if ( action == page.steps.HIDE )
  {
    $(stepId).hide();
  }
};

/**
 * Initializing the Expand/Collapse of the Step
 */
page.steps.initCollapsibleStep = function ( )
{
  $A( document.getElementsByClassName( "collapsibleStepTitle" ) ).each( function( stepTitle ) {
    Event.observe( $( stepTitle ), "click", this.page.steps.collapsibleStep.bindAsEventListener( this, stepTitle ) );
    Event.observe( $( stepTitle ), "keydown",
         function( event ) {
            var key = event.keyCode || event.which;
            if ( key == Event.KEY_RETURN || key == 32 )
            {
              page.steps.collapsibleStep( event, stepTitle );
            }
         }
    );
  });
};

page.steps.collapsibleStep = function( event, stepTitle )
{
    var content = $( stepTitle ).up().down("div");
    if ( content.visible() )
    {
      stepTitle.removeClassName( "collapsibleStepExpanded" );
      content.removeClassName( "collapsibleStepContentExpanded" );
      Effect.toggle(content.id, "slide", { duration: 0.5 });
      content.setAttribute("aria-hidden", "true");
      stepTitle.setAttribute("aria-expanded", "false");
    }
    else
    {
      stepTitle.addClassName( "collapsibleStepExpanded" );
      content.addClassName( "collapsibleStepContentExpanded" );
      Effect.toggle(content.id, "slide", { duration: 0.5 } );
      content.setAttribute("aria-hidden", "false");
      stepTitle.setAttribute("aria-expanded", "true");
    }
    Event.stop( event );
};

page.showChangeTextSizeHelp = function()
{
  page.extendedHelp('internalhandle=change_text_size&helpkey=change_text_size','change_text_size' );
  return false;
};

page.showAccessibilityOptions = function()
{
   var win = window.open('/webapps/portal/execute/changePersonalStyle?cmd=showAccessibilityOptions',
       'accessibilityOptions','menubar=1,resizable=1,scrollbars=1,status=1,width=768,height=600');
   win.focus();
};

page.toggleContrast = function( )
{
  new Ajax.Request('/webapps/portal/execute/changePersonalStyle?cmd=toggleContrast',
  {
    onSuccess: function(transport, json)
    {
      var fsWin;
      if (window.top.nav)
      {
        fsWin = window.top;
      }
      else if (window.opener && window.opener.top.nav)
      {
        fsWin = window.opener.top;
        window.close();
      }
      if (fsWin)
      {
        fsWin.nav.location.reload();
        fsWin.content.location.reload();
      }
      else
      {
        window.top.location.reload();
      }
    }
  });
  return false;
};

page.showPrivacyPolicy = function(cookieNonce, isFramesetSupported) {
  cookieConsent = new CookieConsent('/webapps/privacy-disclosure/');
  cookieConsent.showPolicy( cookieNonce, isFramesetSupported );
};

/**
 * IFrame-based shim used with popups so they render on top of all other page elements (including applets)
 */
page.popupShim = Class.create();
page.popupShim.prototype =
{
  initialize: function( popup )
  {
    this.popup = popup;
  },

  close: function( )
  {
    this.toggleOverlappingEmbeds( false );
  },

  open: function( )
  {
    this.toggleOverlappingEmbeds( true );
  },

  toggleOverlappingEmbeds: function( turnOff )
  {
    ['embed','object','applet','select'].each( function( tag ) {
      var elems = document.getElementsByTagName( tag );
      for ( var i = 0, l = elems.length; i < l; i++ )
      {
        var e = $(elems[i]);

        /* Only show/hide overlapping object if the element is visible in the first place, otherwise there is no point.
         * Note that visible() checks the display property, and behaves differently from the visibility property being
         * set below, so we're safe when this method is being called with turn off|on.
         */
        if( e.visible() )
        {
          if ( !turnOff || ( page.util.elementsOverlap( this.popup, e ) && !e.descendantOf( this.popup ) ) )
          {
            elems[i].style.visibility = ( turnOff ? 'hidden' : '' );
          }
        }
      }
    }.bind( this ) );
  }
};

/**
 * Looks through the children of the specified element for links with the specified
 * class name, and if it finds any, autowires lightboxes to them.  If lightbox.js/effects.js
 * hasn't already been loaded, load it.
 */
page.LightboxInitializer = Class.create(
{
  initialize: function( className, parentElement, justThisParent )
  {
    this.className = className;
    if (justThisParent)
    {
      this.parentElement = parentElement;
    }
    var links = parentElement.getElementsByTagName('a');
    for ( var i = 0, l = links.length; i < l; i++ )
    {
      if ( page.util.hasClassName( links[i], className ) )
      {
        if ( window.lightbox && window.Effect)
        {
          this._autowire();
        }
        else
        {
          this._load();
        }
        break;
      }
    }
  },

  _autowire: function()
  {
    lightbox.autowireLightboxes( this.className, this.parentElement );
  },

  _load: function()
  {
    var h = $$('head')[0];
    // TODO: This code does not take version into account (so immediately after an upgrade this won't get the new file)...
    var scs = ( !window.lightbox ? [getCdnURL('/javascript/ngui/lightbox.js')] : []).concat(
                !window.Effect ? ['/javascript/scriptaculous/effects.js'] : [] );
    scs.each( function( sc )
    {
      var s = new Element('script', { type: 'text/javascript', src: getCdnURL(sc) } );
      h.appendChild( s );
    });
    this._wait();
  },

  _wait: function()
  {
    var count = 0;
    new PeriodicalExecuter( function( pe )
    {
      if ( count < 100 )
      {
        count++;
        if ( window.lightbox && window.Effect )
        {
          pe.stop();
          this._autowire();
        }
      }
      else // give up if it takes longer than 5s to load lightbox.js/effects.js
      {
        pe.stop();
      }
    }.bind(this), 0.05 );
  }
});




page.util.flyoutMenuMainButtonKeyboardHandler = function( event )
{
  var key = event.keyCode || event.which;
  if (key == Event.KEY_LEFT || key == Event.KEY_RIGHT)
  {
    var elem = Event.element( event );
    var target = elem.up( 'li' );
    while ( true )
    {
      if ( key == Event.KEY_LEFT )
      {
        target = target.previous();
      }
      else if ( key == Event.KEY_RIGHT )
      {
        target = target.next();
      }
      if ( !target || page.util.hasClassName( target, 'sub' ) ||
                      page.util.hasClassName( target, 'mainButton' ) ||
                      page.util.hasClassName( target, 'mainButtonType' ) )
      {
        break;
      }
    }
    if ( target )
    {
      var menuLinks = $A( target.getElementsByTagName( 'a' ) );
      if ( menuLinks && menuLinks.length > 0 )
      {
        menuLinks[ 0 ].focus();
        Event.stop( event );
      }
    }
  }
};

page.util.initFlyoutMenuBehaviourForListActionMenuItems = function( container ) {
  //Initialize accessible flyout menu behavior
  if ( !container )
  {
    container = document;
  }
  var uls = document.getElementsByTagName('ul');
  if (uls) {
    var numUls = uls.length;
    for (var i = 0; i < numUls; i++) {
      var ul = uls[i];
      if (page.util.hasClassName(ul, 'nav')) {
        var lis = ul.getElementsByTagName('li');
        if (lis) {
          var numLis = lis.length;
          for (var j = 0; j < numLis; j++) {
            var li = lis[j];
            if (page.util.hasClassName(li, 'switch')) {
              var menu = new page.FlyoutMenu($(li));
              var menuLink = $($(li).getElementsByTagName('a')[0]);
              Event.stopObserving( menuLink, 'mouseover' );
              Event.stopObserving( menuLink, 'click' );
              Event.observe( menuLink, 'click', menu.onToggle.bindAsEventListener( menu ));
            } else if (page.util.hasClassName(li, 'sub')) {
              new page.FlyoutMenu($(li));
            } else if (page.util.hasClassName(li, 'mainButton') || page.util.hasClassName(li, 'mainButtonType')) {
              var menuLinks = $A($(li).getElementsByTagName('a'));
              if (menuLinks && menuLinks.length > 0) {
                Event.observe(menuLinks[0], 'keydown', page.util.flyoutMenuMainButtonKeyboardHandler.bindAsEventListener(menuLinks[0]));
              }
            }
          }
        }
      }
    }
  }
};

//LRN-67276 because of the 'same-origin' policy, the browser cannot inspect the DOM of embedded frames/iframes where the
//source is on a different 'origin'. if that happens, catch the exception and make sure we return a valid value for maxHeight
page.util.getMaxContentHeight = function( iframeElement )
{
  var maxHeight = iframeElement.contentWindow.document.body.scrollHeight;
  var frameElements;
  var iframeElements;
  if ( iframeElement.contentDocument )
  {
    // getElementsByTagName() returns a NodeList object, which is immutable and cannot easily be converted to an array
    frameElements = iframeElement.contentDocument.getElementsByTagName("frame");
    iframeElements = iframeElement.contentDocument.getElementsByTagName("iframe");
  }

  var i = 0;
  var frameHeight;
  var frameElement;

  try
  {
    for( i = 0; i < frameElements.length; i++ )
    {
      frameElement = frameElements[i];

      if( frameElement.contentWindow && frameElement.contentWindow.document && frameElement.contentWindow.document.body )
      {
        frameHeight = frameElement.contentWindow.document.body.scrollHeight;
      }

      if( frameHeight > maxHeight )
      {
        maxHeight = frameHeight;
      }
    }
  }
  catch (e)
  {
    // ignore - see same-origin comment at the top of this function
  }

  try
  {
    for( i = 0; i < iframeElements.length; i++ )
    {
      frameElement = iframeElements[i];

      if( frameElement.contentWindow && frameElement.contentWindow.document && frameElement.contentWindow.document.body )
      {
        frameHeight = frameElement.contentWindow.document.body.scrollHeight;
      }

      if( frameHeight > maxHeight )
      {
        maxHeight = frameHeight;
      }
    }
  }
  catch (e)
  {
    // ignore - see same-origin comment at the top of this function
  }

  return maxHeight;
};

//LRN-67276 because of the 'same-origin' policy, the browser cannot inspect the DOM of embedded frames/iframes where the
//source is on a different 'origin'. if that happens, catch the exception and make sure we return a valid value for maxWidth
page.util.getMaxContentWidth = function( iframeElement )
{
  var maxWidth = iframeElement.contentWindow.document.body.scrollWidth;
  var frameElements;
  var iframeElements;
  if ( iframeElement.contentDocument )
  {
    // getElementsByTagName() returns a NodeList object, which is immutable and cannot easily be converted to an array
    frameElements = iframeElement.contentDocument.getElementsByTagName("frame");
    iframeElements = iframeElement.contentDocument.getElementsByTagName("iframe");
  }

  var i = 0;
  var frameWidth;
  var frameElement;

  try
  {
    for( i = 0; i < frameElements.length; i++ )
    {
      frameElement = frameElements[i];

      if( frameElement.contentWindow && frameElement.contentWindow.document && frameElement.contentWindow.document.body )
      {
        frameWidth = frameElement.contentWindow.document.body.scrollWidth;
      }

      if( frameWidth > maxWidth )
      {
        maxWidth = frameWidth;
      }
    }
  }
  catch (e)
  {
    // ignore - see same-origin comment at the top of this function
  }

  try
  {
    for( i = 0; i < iframeElements.length; i++ )
    {
      frameElement = iframeElements[i];

      if( frameElement.contentWindow && frameElement.contentWindow.document && frameElement.contentWindow.document.body )
      {
        frameWidth = frameElement.contentWindow.document.body.scrollWidth;
      }

      if( frameWidth > maxWidth )
      {
        maxWidth = frameWidth;
      }
    }
  }
  catch (e)
  {
    // ignore - see same-origin comment at the top of this function
  }

  return maxWidth;
};

page.subheaderCleaner =
{
  init : function( entityKind, divId )
  {
    var allHidden = true;
    var firstUl = null;
    var className = 'portletList-img courseListing ' + entityKind;
    var parentElement = $( divId ) || document;
    $A( parentElement.getElementsByClassName( className ) ).each( function( ul ) {
      if ( !ul.down() )
      {
        var prev = ul.previous( 'h3' ) || ul.previous( 'h4' );
        prev.hide();
        ul.hide();
        if ( !firstUl )
        {
          firstUl = ul;
        }
      }
      else
      {
        allHidden = false;
      }
    } );
    // if term grouping, hide term headings without courses/orgs
    className = 'termHeading-' + entityKind;
    $A( parentElement.getElementsByClassName( className ) ).each( function( termHeading ) {
      var hasVisibleBlocks = $A( termHeading.next( 'div' ).select( 'ul' ) ).any( function( block )
      {
        return block.visible();
      } );
      if ( !hasVisibleBlocks )
      {
        termHeading.hide();
      }
    } );
    if ( allHidden && firstUl )
    {
      firstUl.up( 'div' ).previous( 'div' ).show();
    }
  }
};

 /**
  * Set up any JavaScript that will always be run on load (that doesn't depend on
  * any application logic / localization) here.
  *
  * Please leave this at the bottom of the file so it's easy to find.
  *
  */
FastInit.addOnLoad( function()
{
  Event.observe( document.body, "click", page.ContextMenu.closeAllContextMenus.bindAsEventListener( window ) );

  Event.observe( document.body, "click", page.ContextMenu.alignArrowsInBreadcrumb.bindAsEventListener( window ) );

  Event.observe( document.body, 'keydown', function(event) {
    var key = event.keyCode || event.which;
    if ( key == 116 )  // reload current page on F5 key press
    {
      Event.stop( event );  // prevent browser from reloading complete frameset
      if ( Prototype.Browser.IE )
      {
        event.keyCode = 0;
      }
      (function() { window.location.reload( true ); }.defer());
      return false;
    }
  });

  page.util.initFlyoutMenuBehaviourForListActionMenuItems();

  if ( $('breadcrumbs') )
  {
    new page.BreadcrumbExpander($('breadcrumbs'));
    // If we're in the content wrapper, hide the content wrapper breadcrumb frame
    // so that we don't get stacked breadcrumbs.
    if ( window.name === 'contentFrame' )
    {
      var parent = window.parent;
      if ( parent )
      {
        var frameset = parent.document.getElementById( 'contentFrameset' );
        if ( frameset )
        {
          frameset.rows = "*,100%";
        }
      }
    }
  }

  var contentPane = $('contentPanel') || $('portalPane');
  if ( contentPane )
  {
    new page.LightboxInitializer( 'lb', contentPane );
  }

  // add a label for inventory table checkboxes, if needed
  $A(document.getElementsByTagName("table")).each( function( table )
  {
    if ( !page.util.hasClassName( table, 'inventory' ) )
    {
      return;
    }
    var rows = table.rows;
    if ( rows.length < 2 )
    {
      return;
    }
    for (var r = 0, rlen = rows.length - 1; r < rlen; r++)
    {
      var cells = rows[r+1].cells; // skip header row
      for (var c = 0, clen = cells.length; c < clen; c++)
      {
        var cell = $(cells[c]);
        var inp = cell.down('input');

        if ( !inp || ( inp.type != 'checkbox' && inp.type != 'radio' ) )
        {
          // We're only looking for checkbox/radio cells to label, so move on
          continue;
        }

        var lbl = cell.down('label');

        if (lbl && !lbl.innerHTML.blank())
        {
          break; // skip cells that already have a non-blank label
        }

        if ( !lbl )
        {  // add new label to checkbox
          lbl = new Element('label', {htmlFor: inp.id} );
          lbl.addClassName('hideoff');
          cell.insert({bottom:lbl});
        }
        var headerCell = $(cell.parentNode).down('th');
        if ( !headerCell )
        {
          break; // skip rows without header cell
        }

        // create a temporary clone of the header cell and remove any hidden divs I.e. context menus
        var tempCell = $(headerCell.cloneNode(true));
        var tempCellDivs = tempCell.getElementsByTagName("div");
        for ( var i = 0; i < tempCellDivs.length; i++ )
        {
          var d = tempCellDivs[i];
          if ( d && !$(d).visible() )
          {
            d.remove();
          }
        }
        var lblBody = tempCell.innerHTML.replace( /<\/?[^>]*>/g, '' );  // strip html tags from header
        lblBody = page.bundle.getString('inventoryList.select.item', lblBody);
        lbl.update( lblBody );  // set label to header contents (minus tags)
        break;
      }
    }
  });

  //set default font sizes to display text. hack to fix IE7 default font size issue.
  var sizes = {1:'xx-small', 2:'x-small', 3:'small', 4:'medium', 5:'large', 6:'x-large', 7:'xx-large'};
  var fonts = document.getElementsByTagName('font');
  for ( var i = 0; i < fonts.length; i++ )
  {
    var font = fonts[i];
    if ( font.size )
    {
      // Since some font elements may be manually created by end users we have to handle random
      // values in here.
      if (!font.size.startsWith("+") && !font.size.startsWith("-"))
      {
        var fsize = parseInt(font.size, 10);
        if (fsize > 0 && fsize < 8)
        {
          font.style.fontSize = sizes[fsize];
        }
      }
    }
  }

  page.scrollToEnsureVisibleElement();
  page.isLoaded = true;

});

/**
 * Class for adding an insertion marker within a list
 */
page.ListInsertionMarker = Class.create();
page.ListInsertionMarker.prototype =
{
  initialize: function( listId, position, key, text )
  {
    var list = $(listId);
    var listElements = list.childElements();
    // create a marker list item
    var marker = new Element('li',{'id':listId+':'+key, 'class':'clearfix separator' });
    marker.update('<h3 class="item" id=""><span class="reorder editmode"><span><img alt="" src="' + getCdnURL( "/images/ci/icons/generic_updown.gif" ) + '"></span></span><span class="line"></span><span class="text">'+text+'</span></h3>');
    //marker.setStyle({  position: 'relative', minHeight: '10px', padding: '0px', background: '#CCCCCC' });
    position = ( position > listElements.length ) ? listElements.length : position;

    // add marker to list
    if (listElements.length === 0)
    {
      list.insert({top:marker}); // add marker to top of empty list
    }
    else if (listElements.length == position)
    {
      list.insert({bottom:marker});  // add marker after last element
    }
    else
    {
      listElements[position].insert({before:marker});  // add marker before element at position
    }

    var select = $('reorderControls'+listId).down('select');
    // add a option for the marker to the keyboard repostioning select, if any
    if (select)
    {
      var option = new Element('option',{'value':key}).update( '-- '+text+' --' );
      if (listElements.length === 0)
      {
        select.insert({top:option});
      }
      else if (listElements.length == position)
      {
        select.insert({bottom:option});
      }
      else
      {
        $(select.options[position]).insert({before:option});
      }
    }
  }
};

page.scrollToEnsureVisibleElement = function()
{
  var params = window.location.search.parseQuery();
  var ensureVisibleId = params.ensureVisibleId;
  if (!ensureVisibleId)
  {
    return;
  }
  var ensureVisibleElement = $(ensureVisibleId);
  if (!ensureVisibleElement)
  {
    return;
  }
  var pos = ensureVisibleElement.cumulativeOffset();
  var scrollY = pos.top;
  var bodyHeight = $(document.body).getHeight();
  if (scrollY + ensureVisibleElement.getHeight() < bodyHeight)
  {
    return; // element is already visible
  }

  var receipt = $("inlineReceipt_good");
  if (receipt && receipt.visible())
  {
    // pin receipt to top
    var offset = receipt.cumulativeOffset();
    offset.top = globalNavigation.getNavDivHeight();
    var w = parseInt(receipt.getStyle("width"), 10);
    if (Prototype.Browser.IE)
    {
      // width in IE includes border & padding, need to remove it
      var bw = parseInt(receipt.getStyle('borderLeftWidth'), 10) + parseInt(receipt.getStyle('borderRightWidth'), 10);
      var pw = parseInt(receipt.getStyle('paddingLeft'), 10) + parseInt(receipt.getStyle('paddingRight'), 10);
      w = w - bw - pw;
    }

    // scroll window to show ensureVisibleElement
    window.location = "#" + ensureVisibleId;

    //pin reciept top of screen if scroll does not equal zero.  If scroll is 0  it will be pinned directly under the main navigation.
    if (document.viewport.getScrollOffsets()["top"] < offset.top)
    {
      topPosition = offset.top + "px";
    } else {
      topPosition = 0;
    }

    receipt.setStyle({
      position: "fixed",
      zIndex: "1000",
      left: offset.left + "px",
      top: topPosition,
      width: w + "px"
    });

    scrollY = scrollY - 2 * receipt.getHeight();
  }

  //on scroll keep reciept pinned to top of screen.  If scroll is 0, it will be pinned directly under the main navigation.
  if (receipt && receipt.visible())
  {
    Event.observe(window, "scroll", function()
    {
      if (document.viewport.getScrollOffsets()["top"] < offset.top)
      {
        receipt.setStyle({
          top: offset.top + "px"
        });
      }
      else
      {
        receipt.setStyle({
          top: 0
        });
      }
    });
  }
};

/**
 * Recursively walks up the frameset stack asking each window to change their
 * document.domain attribute in anticipation of making a cross-site scripting
 * call to an LMS integration.
 *
 * <p>This should only be called from popup windows, as changing the document.domain
 * value of a window that is going to be reused later could do surprising things.
 *
 * @param domain Domain name shared by the Learn and LMS servers.
 */
page.setLmsIntegrationDomain = function( domain )
{
  if ( '' == domain )
  {
    return;
  }

  try
  {
    if ( parent.page.setLmsIntegrationDomain )
    {
      parent.page.setLmsIntegrationDomain( domain );
  }
  }
  catch ( err ) { /* Ignore */ }

  document.domain = domain;
};

page.refreshTopFrame = function()
{
  if ( window.top.nav )
  {
    window.top.nav.location.reload();
  }
};

// See BreadcrumbBarRenderer.java for code that calls this method.
page.rewriteTaskStatusUntilDone = function( spanId, taskId, courseId )
{
  var theSpan = $(spanId);
  if (theSpan)
  {
    new Ajax.Request("/webapps/blackboard/execute/getSystemTaskStatus?taskId=" + taskId + "&course_id=" + courseId ,
                     {
                       method: 'post',
                       onSuccess: function(transport, json)
                       {
                         var result = transport.responseText.evalJSON( true );
                         theSpan = $(spanId); // reload it just in case it was removed between the request and response
                         if (theSpan)
                         {
                           theSpan.update(result.text);
                           if (result.complete == "false")
                           {
                             setTimeout(function() {page.rewriteTaskStatusUntilDone(spanId, taskId, courseId);}, 3000);
                           }
                         }
                       },
                       onFailure: function(transport, json)
                       {
                         theSpan = $(spanId); //reload the span as above
                         if (theSpan)
                         {
                           theSpan.hide();
                           $(spanId+'error').show();
                         }
                       }
                     });
  }
};

/*
 * Clean up the task id which associated with the specified course, so that the inline warning does not show up again
 */
page.cleanTaskId = function( courseId, nonce )
{
  // we don't care about the result, at worse it will display again on the next page
  var url = "/webapps/blackboard/execute/courseMain?action=cleanTaskId&course_id=" + courseId +
            "&blackboard.platform.security.NonceUtil.nonce.ajax=" + nonce;
  new Ajax.Request( url, { method: 'post' } );
};

//that doesn't then any code utilizing these methods will not work 'as expected'. Current usage
//as/of the writing of this code is "ok" with that - the user won't get the perfect experience but it won't completely fail either.
page.putInSessionStorage = function( key, value )
{
  if ( typeof sessionStorage !== 'undefined' )
  {
    sessionStorage[ getCookie( 'JSESSIONID' ) + key ] = value;
  }
};

// any code utilizing these methods must have separately included cookie.js
// since we don't always include cookie.js
page.getFromSessionStorage = function( key )
{
  if ( typeof sessionStorage !== 'undefined' )
  {
    return sessionStorage[ getCookie( 'JSESSIONID' ) + key ];
  }
  return undefined;
};

page.aria = {};

page.aria.show = function ( element, button )
{
  $(element).show();
  if ( !!button ) {
    button.setAttribute("aria-expanded", "true");
  }
};

page.aria.hide = function ( element, button )
{
  $(element).hide();
  if ( !!button ) {
    button.setAttribute("aria-expanded", "false");
  }
};

page.aria.toggle = function ( element, button )
{
  if (Element.visible($(element)))
  {
    page.aria.hide(element, button);
  }
  else
  {
    page.aria.show(element, button);
  }
};

page.util.isIE = function ()
{
  return ( navigator.userAgent.toLowerCase().indexOf( "msie" ) != -1 );
};

page.util.isFirefox = function()
{
  return ( navigator.userAgent.toLowerCase().indexOf( "firefox" ) != -1 );
};

/*
 * We'd probably never want to set an empty title on an html element but unfortunately
 * due to a browser rendering issue(FF 20), there currently is a practical reason to do
 * so. By setting a title to a 'blank space'(!), we can prevent the title from the parent
 * element to show up when the user is interacting with a child {code}element{code}.
 * Currently this is necessary only for FF, and it can be changed as a need arise but you
 * MUST NOT set an empty space title in IE/Chrome because they will render it as an empty
 * title tooltip, which we don't want.
 * NOTE : An empty space title will be set only if a title is not already set to something
 *   other than an empty String.
 * Bug Ref. : LRN-67140
 */
page.util.setEmptyTitle = function( element )
{
  if( page.util.isFirefox() )
  {
    if ( element.title.blank() )
    {
      page.util.setTitle( element, ' ' );
    }
  }
};

page.util.setTitle = function( element, title )
{
  element.setAttribute( 'title', title );
};


page.FocusTrap = Class.create();
page.FocusTrap.prototype =
{
  /**
   * this method injects 2 invisible spans used to trap the focus inside this given div.  Once you tab into the div you
   * stay inside the div - should only be used on pages where you've dynamically loaded the div and placed the user into it
   * to start (otherwise on a full page reload this could be confusing)
   *
   * @param options.mainDiv - the id of the div where we want the focus to be trapped for Accessibility
   * @param options.initialSelector - selector to find the first element to focus on at the top of the div
   * @param options.finalSelector - optional selector to find the last element to focus on (if known)
   */
    initialize : function( options )
    {
      this.options = Object.extend( {
        mainDiv : null,
        initialSelector : null,
        finalSelector : null
      }, options);
      var mainDiv = $( this.options.mainDiv );
      // insert span at the end of the div
      this.endOfDivIndicator = this.getIndicatorSpan('Bot');
      mainDiv.insertBefore( this.endOfDivIndicator, null );
      this.startOfDivIndicator = this.getIndicatorSpan('Top');
      mainDiv.insertBefore( this.startOfDivIndicator, mainDiv.childNodes[0] );
      this.initialSelector = mainDiv.down( this.options.initialSelector );
      if ( this.options.finalSelector )
      {
        this.finalSelector = mainDiv.down( this.options.finalSelector );
      }

      // Note: Going on both keydown and keyup so that you can hold down the TAB key and have it work properly.
      Event.observe( mainDiv, 'keydown', this.handleKeyDown.bind(this) );
      Event.observe( mainDiv, 'keyup', this.handleKeyDown.bind(this) );
    },

    getIndicatorSpan : function (loc)
    {
      var span = new Element( "span" ).addClassName( "focustrap" );
      span.setAttribute( "tabIndex", "0" );
      span.id = 'focusTrap_' + loc + this.options.mainDiv;
      return span
    },

    handleKeyDown : function( event )
    {
      var code = event.keyCode || event.which;
      var elem = event.element();
      if ( code == Event.KEY_TAB)
      {
        // Note that while this logic does "work" it seems to have an issue we might be able to live with:
        // 1) Going backwards this has an explicit 'blank' item that you tab to which will be confusing (i.e. focusing on the end-of-div indicator
        // doesn't help unless we shift-tab again).  We might be able to make this work better by simulating another copy of event... another day though.
        if (event.shiftKey && this.startOfDivIndicator == elem)
        {
          // Going backwards
          if ( this.finalSelector )
          {
            page.util.focusAndScroll( this.finalSelector );
          }
          else
          {
            page.util.focusAndScroll( this.endOfDivIndicator );
            /* Tried a few things - leaving them here as work-in-progress... it doesn't work.
            var evt = document.createEvent( "KeyboardEvent" );
            if ( evt.initKeyEvent )
            {
              evt.initKeyEvent( "keyup", true, true, null, 0, 0, true, 0, Event.KEY_TAB,  Event.KEY_TAB );
            }
            else
            {
              evt.initKeyboardEvent( "keyup", true, true, null, 0, 0, true, 0, Event.KEY_TAB,  Event.KEY_TAB );
            }
            this.endOfDivIndicator.dispatchEvent( evt );
            */
          }
        }
        else if (!event.shiftKey && this.endOfDivIndicator == elem)
        {
          // going forwards.
          page.util.focusAndScroll(this.initialSelector);
        }
      }
    }
};

page.treatEnterAsClickOnElement = function( buttonElementId )
{
  Event.observe( $(buttonElementId), 'keypress', function(evt)
  {
    if ( evt.keyCode == Event.KEY_RETURN )
    {
      page.util.fireClick(this);
    }
  });
};

}
/* ==================================================================
 *The JavaScript Validation objects to be used in form validation.
 * Copyright (c) 2001 by Blackboard, Inc.,
 * 1899 L Street, NW, 5th Floor
 * Washington, DC, 20036, U.S.A.
 * All rights reserved.
 * Submit RFC & bugs report to: aklimenko@blackboard.com
 * This software is the confidential and proprietary information
 * of Blackboard, Inc. ("Confidential Information").  You
 * shall not disclose such Confidential Information and shall use
 * it only in accordance with the terms of the license agreement
 * you entered into with Blackboard.
 * ==================================================================*/

/**
 * General purpose DOM utility methods. There's probably a better place for this.
 * Private methods and properties have names prefixed with "_".
 */
var bbDomUtil = {

  _inputTypes: [ 'input', 'textarea', 'select', 'button' ],

  _maxRecursion: 500,

  /**
   * @param elName name of the form input element (the request parameter name).
   * @return an array of two or more elements, a single element, or null.
   */
  getInputElementByName: function( elName )
  {
    var elArray = this._getInputElementsByNameInSection( 'dataCollectionContainer', elName );
    if ( elArray.length === 0 )
    {
      elArray = this._getInputElementsByName( elName );
    }
    return ( elArray.length === 0 ) ? null : ( elArray.length == 1 ? elArray[ 0 ] : elArray );
  },

  /*
   * @param sectionId the ID of any element inside a form
   * @return the enclosing form element or null
   */
  getEnclosingForm: function( sectionId )
  {
    var form = null;
    if ( sectionId )
    {
      var count;
      var section = document.getElementById( sectionId );
      while ( section )
      {
        ++count;
        if ( count > this._maxRecursion )
        {
          break;
        }
        if ( section.tagName && section.tagName.toLowerCase() == "form" )
        {
          form = section;
          break;
        }
        section = section.parentNode;
      }
    }
    return ( !form ) ? ( document.forms.length === 0 ? null : document.forms[ 0 ] ) : form;
  },

  /**
   * Adds some additional processing to account for an IE bug
   * @param id the ID of an element
   */
  getElementById: function( id )
  {
    var el = $( id );
    try
    {
      if ( el &&
           /msie|internet explorer/i.test( navigator.userAgent ) &&
           el.attributes.id &&
           el.attributes.id.value != id &&
           document.all )
      {
        // IE usually returns item at 0
        for ( var i = 0; i < document.all[ id ].length; ++i )
        {
          if ( document.all[ id ][ i ].attributes.id && document.all[ id ][ i ].attributes.id.value == id )
          {
            return $( document.all[ id ][ i ] );
          }
        }
      }
    }
    catch ( e )
    {
      // Ignore all exceptions
    }
    return el;
  },

  syncCheckboxToInput: function( checkboxElement, inputElement )
  {
    var checkbox = $( checkboxElement );
    var input = $( inputElement );
    if ( checkbox && input )
    {
      var checkIfNotEmpty = function( )
      {
        checkbox.checked = ( input.value.strip?input.value.strip( ):input.value )?true:false;
      };
      input.observe( 'change', checkIfNotEmpty );
      input.observe( 'blur', checkIfNotEmpty );
    }
  },

  /**
   * @param sectionId the ID of an element that restricts the scope of elements. Cannot be null.
   * @param elName name of the form input element (the request parameter name). Cannot be null.
   * @return an array of zero or more elements with the specified name in the scope of the specified parent element.
   */
  _getInputElementsByNameInSection: function( sectionId, elName )
  {
    var result = [];
    if ( sectionId )
    {
      var section = document.getElementById( sectionId );
      if ( section )
      {
        for ( var i = 0; i < this._inputTypes.length; ++i )
        {
          var elements = section.getElementsByTagName( this._inputTypes[ i ] );
          for ( var j = 0; j < elements.length; ++j )
          {
            if ( elements[ j ].name == elName )
            {
              result.push( elements[ j ] );
            }
          }
        }
      }
    }
    return result;
  },

  /**
   * @param elName name of the form input element (the request parameter name). Cannot be null.
   * @return an array of zero or more elements with the specified name.
   */
  _getInputElementsByName: function( elName )
  {
    var result = [];
    var elArray = document.getElementsByName( elName );
    var formName = null;
    for ( var i = 0; i < elArray.length; ++i )
    {
      if ( elArray[ i ].tagName.match( /^(input|select|textarea|button)$/i ) )
      {
        if ( elArray[ i ].form !== null )
        {
          if ( !formName )
          {
            formName = elArray[ i ].form.name;
          }
          else if ( formName != elArray[ i ] .form.name )
          {
            // Ignore elements that don't belong to the same form as the first one found.
            continue;
          }
        result.push( elArray[ i ] );
        }
      }
    }
    return result;
  }
};

/************************************************************
* Object formCheckList. Use this object to hold form objects
* to be validated and perform form validation
************************************************************/

var addElement, removeElement, removeAllElements, getElement, checkForm, CheckGroup;

var formCheckList = new formCheckList();
var skipValidation=false;

function formCheckList()
{
    this.checkList  = [];
    this.addElement = addElement;
    this.removeElement = removeElement;
    this.removeAllElements = removeAllElements;
    this.getElement = getElement;
    this.check      = checkForm;
}

function addElement(element)
{
    if ( typeof element.group != 'undefined' )
    {
        for ( var i=0; i < this.checkList.length;i++ )
        {
            if ( this.checkList[i].name == element.group )
            {
                this.checkList[i].addElement(element);
                return;
            }
        }
        var grp = new CheckGroup(element);
        grp.addElement(element);
        this.checkList[this.checkList.length] = grp;
        return;
    }
    this.checkList[this.checkList.length] = element;
}

function removeElement(name)
{
  for (var i = 0; i < this.checkList.length; ++i)
  {
    if ( this.checkList[i].fieldName == name )
    {
      this.checkList.splice(i, 1);
    }
  }
}

function getElement(name)
{
  for (var i = 0; i < this.checkList.length; ++i)
  {
    if ( this.checkList[i].fieldName == name )
    {
      return this.checkList[i];
    }
  }
}

function removeAllElements()
{
  var valSize = this.checkList.length;
  this.checkList.splice(0, valSize);
}

function checkForm()
{
    if ( typeof(window.invalidAnswersTmp)!='undefined' )
    {
        window.invalidAnswersTmp=[];
    }
    var valid =true;
    for ( var i=0;i<this.checkList.length;i++ )
    {
        if ( this.checkList[i].canValidate && !this.checkList[i].canValidate() )
        {
          // cannot validate the input so skip it and continue onto the next input
          continue;
        }
        if ( !this.checkList[i].check() )
        {
            if ( this.checkList[i].answerChk )
            {
                valid=false;
            }
            else
            {
                return false;
            }
        }
    }
    return valid;
}
///////////////////End of object formCheckList////////////////

/************************************************************
* Object: inputText. Use this object to validate text input in
* your form (for input type == text|password|textarea|BUT NOT FILE!!! (FILE IS READ-ONLY))
************************************************************/
function inputText(h)
{
    if (h.id) {
      this.element       = bbDomUtil.getElementById( h.id );
    } else {
      this.element          = 'bbDomUtil.getInputElementByName("'+h.name+'")';
    }
    this.shouldFocus          = h.shouldFocus;
    if ( h.shouldFocus === undefined )
    {
      this.shouldFocus = true;
    }
    if ( this.shouldFocus )
    {
      this.formatElement        = 'bbDomUtil.getInputElementByName("'+h.display_format+'")';
      this.focusElement         = h.focus_element; // override element for focus in case of error
    }

    this.fieldName                   = h.name;
    this.disable_script              = h.disable_script;
    this.ref_label                   = h.ref_label;

    this.custom_alert                = h.custom_alert;
    this.custom_alert_cmp            = h.custom_alert_cmp;

    this.minlength                   = h.minlength;
    this.maxlength                   = h.maxlength;
    this.trim                        = h.trim;
    this.regex                       = h.regex;
    this.regex_msg                   = h.regex_msg;
    this.regex_match                 = h.regex_match;
    this.verify                      = h.verify;
    this.skipMD5                     = h.skipMD5;
    this.check                       = inputTextCheck;
    this.valid_number                = h.valid_number;
    this.integer_number              = h.integer_number;
    this.min_value                   = h.min_value;
    this.max_value                   = h.max_value;
    this.nonnegative                 = h.nonnegative;
    this.valid_float                 = h.valid_float;
    this.allow_negative_float        = h.allow_negative_float;
    this.valid_points_decimal_places = h.valid_points_decimal_places; // Please keep in sync with the constants in GradeFormat.java.
    this.valid_percent               = h.valid_percent;
    this.allow_negative_percent      = h.allow_negative_percent;
    this.valid_efloat                = h.valid_efloat; // float with optional exponent
    this.valid_email                 = h.valid_email;
    this.valid_url                   = h.valid_url;
    this.required_url                = h.required_url;
    this.invalid_chars               = h.invalid_chars; // eg: /[%&#<>=+,]/g
    this.cmp_element                 = 'bbDomUtil.getInputElementByName("'+h.cmp_field+'")';
    this.cmp_ref_label               = h.cmp_ref_label;
    this.xor                         = h.xor;
    this.cmp_required                = h.cmp_required;
    this.activeX                     = h.activeX;   // synch activeX to hidden field before submission
    this.isHtmlDoc                   = h.isHtmlDoc; // is portfolio with body and html
    this.img_check                   = h.img_check;
    this.empty_value_warn            = h.empty_value_warn;
    this.valid_system_role_id        = h.valid_system_role_id;
    this.required                    = h.required;
    this.canValidate                 = h.canValidate; // callback function to determine whether the inputtext should be validated

    if (h.ref_and_regex === undefined)
    {
      this.ref_and_regex = true;
    }
    else
    {
      this.ref_and_regex = h.ref_and_regex;
    }

    if ( document.all && document.getElementById(h.name+'_ax') )
    {
        this.axobj = document.getElementById(h.name+'_ax');
    }

    // Add here anything you need to validate
}

function isAnEmptyVtbe(val)
{
  // Different browsers populate an 'empty' VTBE with a different blank line - look for any of the known combinations and ignore them.
  // NOTE: Changes to this method need to be reflected in AssessmentDisplayControl.isAnEmptyVtbe
  return ( !val ||
           !val.replace(/<p><\/p>/gi,'').trim() ||
           !val.replace(/<br \/>/gi,'').trim() ||
           !val.replace(/&nbsp;/gi,'').trim());
}

// Do actual check here
function inputTextCheck()
{
    if ( this.shouldFocus === undefined )
    {
      this.shouldFocus = true;
    }

    var element = eval(this.element);
    var cmp_element = eval(this.cmp_element);

    if ( element )
    {
        // don't validate disabled elements
      if (element.disabled)
      {
        return true;
      }

        var focusElement = element;
        if ( this.axobj )
        {
            focusElement = this.axobj;
        }

        this.custom_alert     = (typeof this.custom_alert     != 'undefined') ? this.custom_alert     : '';
        this.custom_alert_cmp = (typeof this.custom_alert_cmp != 'undefined') ? this.custom_alert_cmp : '';

        this.ref_label = (typeof this.ref_label != 'undefined') ? this.ref_label
        : JS_RESOURCES.getFormattedString('field_name.substitute', [element.name]);
        var val    = element.value;
        if ( isAnEmptyVtbe(val) )
        {
            val='';
        }
        var trimmedVal, numVal, isValidNum, re;

        if ( this.activeX && isEmptyWysiwyg(element) )
        {
            element.value = '';
            val = '';
        }

        if ( typeof eval(this.formatElement) != "undefined" && eval(this.formatElement) !== null )
        {
            //Check if it is a mathml where;
            if ( /<APPLET ID="(\d+)" NAME="(\w+)"/.test(element.value) )
            {
                if ( getRadioValue(eval(this.formatElement)) == 'P' )
                {
                    if ( !confirm(JS_RESOURCES.getString('validation.plain_text.confirm')) )
                    {
                        if ( this.shouldFocus )
                        {
                          safeFocus( element );
                        }
                        return false;
                    }
                }
            }
        }

        if ( this.trim )
        {
            val = val.trim();
            element.value = val;
        } //Remove leading & trailing spaces if needed

        if ( typeof cmp_element != 'undefined' )
        {
            if ( this.xor )
            {
                if ( val.trim()=='' ^ cmp_element.value.trim()=='' )
                {
                    if ( val.trim()=='' )
                    {
                        alert( this.custom_alert ? this.custom_alert :
                               JS_RESOURCES.getFormattedString('validation.cmp_field.required',
                                                               [this.ref_label, this.cmp_ref_label]));
                        if ( this.shouldFocus )
                        {
                          shiftFocus(focusElement, this.activeX);
                        }
                    }
                    else
                    {
                        alert(this.custom_alert_cmp ? this.custom_alert_cmp :
                              JS_RESOURCES.getFormattedString('validation.cmp_field.required',
                                                              [this.cmp_ref_label, this.ref_label]));
                        if ( this.shouldFocus )
                        {
                          safeFocus( cmp_element );
                        }
                    }
                    return false;
                }
            }
        }

        if ( this.disable_script )
        {
            if ( typeof eval(this.formatElement) == "undefined" || getRadioValue(eval(this.formatElement)) != 'P' )
            {
                re = /<\s*script/ig;
                var re1 = /<\s*\/\s*script\s*>/ig;
                val = val.replace(re,'<disabled-script');
                val = val.replace(re1,'</disabled-script>');
                var re2 = /href\s*=\s*(['"]*)\s*javascript\s*:/ig;
                val = val.replace(re2,"href=$1disabled-javascript:");
                element.value = val;
            }
        }

        if ( this.valid_number )
        {
            trimmedVal = val.trim();
            //added this check bcoz for numeric fields which are not required, this function was not working
            if ( trimmedVal!="" )
            {
                var numLocalizer = new NumberLocalizer();
                if ( numLocalizer === undefined )
                {
                  numVal = parseInt(trimmedVal, 10);
                }
                else
                {
                  numVal = numLocalizer.parseNumber( trimmedVal );
                }
                isValidNum = !isNaN(numVal);
                if ( !isValidNum )
                {
                    alert(JS_RESOURCES.getFormattedString('validation.number', [this.ref_label]));
                    if ( this.shouldFocus )
                    {
                      safeFocus( element );
                    }
                    return false;
                }
                if (this.integer_number)
                {
                    re = /^[+-]?[0-9]+$/;
                    if ( !re.test( trimmedVal ))
                    {
                        alert(JS_RESOURCES.getFormattedString('validation.integer_number', [this.ref_label]));
                        if ( this.shouldFocus )
                        {
                          safeFocus( element );
                        }
                        return false;
                    }
                }
                if (this.nonnegative && numVal<0)
                {
                    alert(JS_RESOURCES.getFormattedString('validation.negative', [this.ref_label]));
                    if ( this.shouldFocus )
                    {
                      safeFocus( element );
                    }
                    return false;
                }
                if ( ( (this.min_value || this.min_value === 0) && numVal < this.min_value ) ||
                     ( this.max_value && ( numVal > this.max_value ) ) )
                {
                    alert(JS_RESOURCES.getFormattedString('validation.invalid_value', [this.ref_label]));
                    if ( this.shouldFocus )
                    {
                      safeFocus( element );
                    }
                    return false;
                }
            }
        }

        if ( this.valid_float )
        {
            trimmedVal = val.trim();

            var numFormat;
            if ( this.allow_negative_float )
            {
                numFormat = LOCALE_SETTINGS.getString('float.allow.negative.format');
            }
            else
            {
                numFormat = LOCALE_SETTINGS.getString('float.format');
            }

            if ( numFormat )
            {
                //hand parse for l10n
                re = new RegExp( numFormat );
                isValidNum = trimmedVal.search( re ) === 0;
            }
            else
            {
                //try to use platform native (non-localized)
                numVal = parseFloat(trimmedVal);
                isValidNum = !isNaN(numVal);
                if ( isValidNum && numVal.toString().length != trimmedVal.length )
                {
                    /* Allow strings with trailing zeros to pass */
                    re = /^[\.0]+$/;
                    isValidNum = re.test(trimmedVal.substring(numVal.toString().length));
                }
            }
            if ( !isValidNum )
            {
                alert(JS_RESOURCES.getFormattedString('validation.number', [this.ref_label]));
                if ( this.shouldFocus )
                {
                  safeFocus( element );
                }
                return false;
            }
        }

        if ( this.valid_percent )
        {
          if ( this.allow_negative_percent )
          {
            if ( !isValidNegativePercent(val) )
            {
                alert(JS_RESOURCES.getFormattedString('validation.allow_negtive.percent', [this.ref_label]));
                if ( this.shouldFocus )
                {
                  safeFocus( element );
                }
                return false;
            }
          }
          else
          {
            if ( !isPercent(val) )
            {
                alert(JS_RESOURCES.getFormattedString('validation.percent', [this.ref_label]));
                if ( this.shouldFocus )
                {
                  safeFocus( element );
                }
                return false;
            }
          }
        }

        if ( this.valid_efloat )
        {
            if ( !isNumeric(val) )
            {
                alert(JS_RESOURCES.getFormattedString('validation.number', [this.ref_label]));
                if ( this.shouldFocus )
                {
                  focusElement = (this.focusElement ? this.focusElement : this.element);
                  if ( focusElement.focus )
                  {
                      safeFocus( focusElement );
                  }
                }
                return false;
            }
        }

        if ( this.valid_points_decimal_places )
        {
            if ( !validPointsDecimalPlaces(val) )
            {
                alert(JS_RESOURCES.getFormattedString('validation.points.decimal.places.error.location', [this.ref_label]));
                if ( this.shouldFocus )
                {
                  focusElement = (this.focusElement ? this.focusElement : this.element);
                  if ( focusElement.focus )
                  {
                      safeFocus( focusElement );
                  }
                }
                return false;
            }
        }

        if ( this.valid_email )
        {
            if ( val.trim() == '' )
            {
                if ( confirm(JS_RESOURCES.getString('warning.email')) )
                {
                    return true;
                }
                else
                {
                    if ( this.shouldFocus )
                    {
                      safeFocus( element );
                    }
                    return false;
                }
            }
            else
            {
                re = /^(['`a-zA-Z0-9_+\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9])+$/;
                if ( !re.test(val) )
                {
                    alert(JS_RESOURCES.getFormattedString('validation.email', [this.ref_label]));
                    if ( this.shouldFocus )
                    {
                      safeFocus( element );
                    }
                    return false;
                }
            }
        }

        // confirms via javascript pop-up if input field is empty;
        // user can click Ok to proceed or cancel to go back with the element focused
        // the message that pops up is the message passed in with ref_label
        if ( this.empty_value_warn )
        {
            if ( val.trim() == '' )
            {
                if ( confirm(this.ref_label) )
                {
                    return true;
                }
                else
                {
                    if ( this.shouldFocus )
                    {
                      safeFocus( element );
                    }
                    return false;
                }
            }
        }

if ( val.length < this.minlength )
        {
            if ( this.minlength == 1 )
            {
                alert(this.custom_alert ? this.custom_alert
                      : JS_RESOURCES.getFormattedString('validation.required', [this.ref_label]));
            }
            else
            {
                alert(this.custom_alert ? this.custom_alert
                      : JS_RESOURCES.getFormattedString('validation.minimum_length',
                                                        [this.minlength, this.ref_label]));
            }
            if ( this.shouldFocus )
            {
              shiftFocus(focusElement, this.activeX);
            }
            return false;
        }

        var extra = 0;
      if (navigator.appName=="Netscape" &&
          parseInt(navigator.appVersion, 10 )>=5) {
         var index = val.indexOf('\n');
         while(index != -1) {
             extra += 1;
             index = val.indexOf('\n',index+1);
         }
      }
    if ( this.maxlength < val.length + extra )
        {
          var newlength = val.length + extra;
            if ( (newlength - this.maxlength) > 1 )
            {
                alert(JS_RESOURCES.getFormattedString('validation.maximum_length.plural',
                                                      [this.ref_label,this.maxlength,(newlength-this.maxlength)]));
            }
            else
            {
                alert(JS_RESOURCES.getFormattedString('validation.maximum_length.singular',
                                                      [this.ref_label,this.maxlength]));
            }
            if ( this.shouldFocus )
            {
              shiftFocus(focusElement, this.activeX);
            }
            return false;
        }

        // required_url, unlike valid_url, flags empty strings as invalid URLs.
        if ( this.required_url )
        {
            if ( val.trim() == '' )
            {
                alert(JS_RESOURCES.getFormattedString('validation.required', [this.ref_label]));
                return false;
            }
            
            this.valid_url = true;  // since the url is required, it also must be valid
        }
        
        if ( this.valid_url )
        {
            if ( val.trim()=='' )
            {
                return true;  // should not reach here if required_url is true 
            }

            if ( !isValidUrl(val) )
            {
                alert(JS_RESOURCES.getFormattedString('validation.url', [this.ref_label]));
                if ( this.shouldFocus )
                {
                  safeFocus( element );
                }
                return false;
            }
        }

        if ( typeof(this.regex) == 'string' )
        {
            this.regex=eval(this.regex);
        }

        if ( (typeof(this.regex) == 'object' || typeof(this.regex) == 'function') && val.trim() != '' )
        {
            re =this.regex;
            if ( this.regex_match && val.search(re) == -1 )
            {
                alert(this.regex_msg + (this.ref_and_regex?(this.ref_label + '.'):''));
                if ( this.shouldFocus )
                {
                  shiftFocus(focusElement, this.activeX);
                }
                return false;
            }
            if ( !this.regex_match && re.test(val) )
            {
                alert(this.regex_msg + (this.ref_and_regex?(this.ref_label + '.'):''));
                if ( this.shouldFocus )
                {
                  shiftFocus(focusElement, this.activeX);
                }
                return false;
            }
        }

        if ( this.invalid_chars )
        {
            // if string was passed, convert to regular expression object
            if( Object.isString( this.invalid_chars ) )
            {
                var stringToParse = this.invalid_chars;
                var firstSlashPos = stringToParse.indexOf("/");
                var lastSlashPos = stringToParse.lastIndexOf("/");

                var pattern = stringToParse.substring( ++firstSlashPos, lastSlashPos );
                var modifier = stringToParse.substring( ++lastSlashPos, stringToParse.length );
                this.invalid_chars = new RegExp( pattern, modifier );
            }

            var arr = val.invalidChars(this.invalid_chars);

            if ( arr && arr.length )
            {
                alert(JS_RESOURCES.getFormattedString('validation.invalid_chars',
                                                      [this.ref_label, arr.join(', ')]));
                if ( this.shouldFocus )
                {
                  shiftFocus(focusElement, this.activeX);
                }
                return false;
            }
        }

        if ( this.verify )
        {
            var chk_field = bbDomUtil.getInputElementByName(element.name.replace(/_inp$/,'_chk'));
            var field     = bbDomUtil.getInputElementByName(element.name.replace(/_inp$/,''));

            if ( chk_field.value != val )
            {
                alert(JS_RESOURCES.getFormattedString('validation.mismatch', [this.ref_label]));
                if ( this.shouldFocus )
                {
                  safeFocus( chk_field );
                }
                return false;
            }
            // Encode password
            if ( element.type == 'password' )
            {
                element.value = element.value.trim();
                if ( element.value != '' )
                {
                    if ( !this.skipMD5 )
                    {
                      element.value = field.value = chk_field.value = calcMD5(element.value);
                    }
                }
                else
                {
                    alert(JS_RESOURCES.getString('validation.password'));
                    element.value = field.value ='';
                    if ( this.shouldFocus )
                    {
                      safeFocus( element );
                    }
                    return false;
                }
            }
        }

        if ( this.cmp_required && element.value.trim()!='' )
        {
            if ( !cmp_element.value.trim().length )
            {
                alert(JS_RESOURCES.getFormattedString('validation.cmp_field.rejected',
                                                      [this.ref_label, this.cmp_ref_label]));
                if ( this.shouldFocus )
                {
                  safeFocus( cmp_element );
                }
                return false;
            }
        }

        if ( this.img_check )
        {
            return image_check(element);
        }


    //AS-102122, if a image tag without ALT properties <img src="1.jpg">, add a null ALT for it. <img src="1.jpg" alt="">
    imgTag_check(element,0);


        // System role ids cannot begin with "BB" as of 7.2; such ids are reserved for solely for Blackboard use
        // Checks field to see if string begins with "BB" case-insensitive and if so, alert the user
        if ( this.valid_system_role_id )
        {
            if ( element.value.indexOf('BB') === 0 || element.value.indexOf('bb') === 0 )
            {
                alert(this.custom_alert ? this.custom_alert : JS_RESOURCES.getFormattedString('validation.system_role.reserve', [this.ref_label]));
                if ( this.shouldFocus )
                {
                  safeFocus( element );
                }
                return false;
            }
            else
            {
                return true;
            }
        }

    }
    return true;
}

///////////////////End of object inputText///////////////////
//check ALT propertity for <img tag, if there isn't ALT propertiry, add ALT="" for this tag
function imgTag_check(element , start){
  var imgStart = element.value.indexOf("<img",start); // img: <img src=... >
  if (imgStart > -1 ){
    var end = element.value.indexOf(">",imgStart);
    if (end == -1 ){
      return;
    }
    var imgData = element.value.substring(imgStart, end+1); //  <img src=... >
    if(imgData.indexOf("alt") == -1){
      imgData = "<img alt=\"\" " + imgData.substring(4);
      element.value = element.value.substring(0,imgStart) + imgData + element.value.substring(end+1);
    }
    imgTag_check(element, end);
  }
}

function image_check(element)
{
    var ext = element.value.match(/.*\.(.*)/);
    ext = ext ? ext[1] :'';
    var re = /gif|jpeg|png|tif|bmp|jpg/i;
    if ( ! re.test(ext) && element.value )
    {
        if ( ! confirm(JS_RESOURCES.getFormattedString('validation.image_type', [ext])) )
        {
            element.focus();
            return false;
        }
    }
    return true;
}

/************************************************************
* Object: inputDate. Use this object to validate that the
* associated date fields are not empty
************************************************************/

var inputDateCheck;

function inputDate(h)
{
    this.element_mm        = 'bbDomUtil.getInputElementByName("'+h.name+'_0_mm")';
    this.element_dd        = 'bbDomUtil.getInputElementByName("'+h.name+'_0_dd")';
    this.element_yyyy      = 'bbDomUtil.getInputElementByName("'+h.name+'_0_yyyy")';

    this.fieldName      = h.name;
    this.ref_label      = h.ref_label;

    this.custom_alert     = h.custom_alert;
    this.custom_alert_cmp = h.custom_alert_cmp;

    this.check          = inputDateCheck;

    // Add here anything you need to validate
}

// Do actual check here
function inputDateCheck()
{
    var element_mm   = eval(this.element_mm);
    var element_dd   = eval(this.element_dd);
    var element_yyyy = eval(this.element_yyyy);

    if ( typeof element_mm != 'undefined' && element_dd !='undefined' && element_yyyy !='undefined' )
    {
        this.custom_alert = (typeof this.custom_alert != 'undefined') ? this.custom_alert : '';

        this.ref_label = ( this.ref_label ) ? this.ref_label
        : JS_RESOURCES.getFormattedString('field_name.substitute', [this.element_mm.name]);

        if ( element_mm.selectedIndex == -1 || element_dd.selectedIndex == -1 || element_yyyy == -1 )
        {
            alert(this.custom_alert ? this.custom_alert
                  : JS_RESOURCES.getFormattedString('validation.date.required', [this.ref_label]));

            if ( element_mm.selectedIndex == -1 )
            {
                element_mm.focus();
            }
            else if ( element_dd.selectedIndex == -1 )
            {
                element_dd.focus();
            }
            else
            {
                element_yyyy.focus();
            }

            return false;
        }
    }

    return true;
}
///////////////////End of object inputDate///////////////////

/************************************************************
* Object: inputTime. Use this object to validate that the
* associated time fields are not empty
************************************************************/
var inputTimeCheck;

function inputTime(h)
{
    this.element_hh        = 'bbDomUtil.getInputElementByName("'+h.name+'_0_hh")';
    this.element_mi        = 'bbDomUtil.getInputElementByName("'+h.name+'_0_mi")';
    this.element_am        = 'bbDomUtil.getInputElementByName("'+h.name+'_0_am")';

    this.fieldName      = h.name;
    this.ref_label      = h.ref_label;

    this.custom_alert     = h.custom_alert;
    this.custom_alert_cmp = h.custom_alert_cmp;

    this.check          = inputTimeCheck;

    // Add here anything you need to validate
}

// Do actual check here
function inputTimeCheck()
{
    var element_hh   = eval(this.element_hh);
    var element_mi   = eval(this.element_mi);
    var element_am   = eval(this.element_am);

    if ( typeof element_hh != 'undefined' && element_mi !='undefined' && element_am !='undefined' )
    {
        this.custom_alert = (typeof this.custom_alert != 'undefined') ? this.custom_alert : '';

        this.ref_label = (typeof this.ref_label != 'undefined') ? this.ref_label
        : JS_RESOURCES.getFormattedString('field_name.substitute', [this.element_hh.name]);

        if ( element_hh.selectedIndex == -1 || element_mi.selectedIndex == -1 || element_am == -1 )
        {
            alert(this.custom_alert ? this.custom_alert
                  : JS_RESOURCES.getFormattedString('validation.time.required', [this.ref_label]));

            if ( element_hh.selectedIndex == -1 )
            {
                element_hh.focus();
            }
            else if ( element_mi.selectedIndex == -1 )
            {
                element_mi.focus();
            }
            else
            {
                element_am.focus();
            }
            return false;
        }
    }

    return true;
}

///////////////////End of object inputTime///////////////////

/************************************************************
* Object: inputSelect. Use this object to validate that the
* associated select field is not empty
************************************************************/
var inputSelectCheck;

function inputSelect(h)
{
    this.element        = 'bbDomUtil.getInputElementByName("'+h.name+'")';

    this.fieldName      = h.name;
    this.ref_label      = h.ref_label;

    this.minSelected = h.minSelected;
    this.maxSelected = h.maxSelected;
    this.title      = h.title;
    this.isMultiSelect = h.isMultiSelect;

    this.custom_alert     = h.custom_alert;
    this.custom_alert_cmp = h.custom_alert_cmp;

    this.check          = inputSelectCheck;

    // Add here anything you need to validate
}

// Do actual check here
function inputSelectCheck()
{
    var element   = eval(this.element);
    var checked = 0;
    if ( typeof element != 'undefined' )
    {
        if ( this.isMultiSelect)
        {
            if( this.minSelected )
            {
              //check that at least minSelected number of options is selected //bsomala

              checked = element.options.length;

              if(checked < this.minSelected)
              {
                alert(this.title+' -- '+JS_RESOURCES.getFormattedString('validation.multiSelect.minItems', [this.minSelected]));
              element.focus();
              return false;
              }
            }
            checked = 0;
            if ( this.maxSelected )
            {
              checked = element.options.length;

              if(checked > this.maxSelected)
              {
                alert(this.title+' -- '+JS_RESOURCES.getFormattedString('validation.multiSelect.maxItems', [this.maxSelected]));
              element.focus();
              return false;
              }
            }
        }
        else
        {
          this.custom_alert = (typeof this.custom_alert != 'undefined') ? this.custom_alert : '';

          this.ref_label = (typeof this.ref_label != 'undefined') ? this.ref_label
          : JS_RESOURCES.getFormattedString('field_name.substitute', [element.name]);

          if ( (element.selectedIndex == -1) || (element.options[element.selectedIndex].value == "") )
          {
              alert(this.custom_alert ? this.custom_alert
                    : JS_RESOURCES.getFormattedString('validation.required', [this.ref_label]));
              element.focus();
              return false;
          }
        }
    }

    return true;
}

///////////////////End of object inputSelect///////////////////

/************************************************************
* Object: inputFile. Use this object to validate that the file upload
is not empty. IMPORTANT: file type is READ ONLY
************************************************************/
var inputFileCheck;

function inputFile(h)
{
    this.element        = 'bbDomUtil.getInputElementByName("'+h.name+'")';
    this.fieldName      = h.name;
    this.ref_label      = h.ref_label;

    this.custom_alert     = h.custom_alert;
    this.custom_alert_cmp = h.custom_alert_cmp;

    this.invalid_chars  = h.invalid_chars;
    this.minlength      = h.minlength;
    this.img_check      = h.img_check;
    this.check          = inputFileCheck;

    // Add here anything you need to validate
}


// Do actual check here
function inputFileCheck()
{

    var element = eval(this.element);
    if ( typeof element != 'undefined' )
    {

        this.custom_alert     = (typeof this.custom_alert     != 'undefined') ? this.custom_alert     : '';

        this.ref_label = (typeof this.ref_label != 'undefined') ? this.ref_label
        : JS_RESOURCES.getFormattedString('field_name.substitute', [element.name]);
        var val    = element.value;


        if ( this.invalid_chars )
        {
            var arr = val.invalidChars(this.invalid_chars);

            if ( arr && arr.length )
            {
                alert(JS_RESOURCES.getFormattedString('validation.invalid_chars',
                                                      [this.ref_label, arr.join(', ')]));
                shiftFocus( element, false);
                return false;
            }
        }

        if ( val.length < this.minlength )
        {
            if ( this.minlength == 1 )
            {
                alert(this.custom_alert ? this.custom_alert
                      : JS_RESOURCES.getFormattedString('validation.required', [this.ref_label]));
            }
            else
            {
                alert(this.custom_alert ? this.custom_alert
                      : JS_RESOURCES.getFormattedString('validation.minimum_length',
                                                        [this.minlength, this.ref_label]));
            }

            return false;
        }

        if ( this.img_check )
        {
            return image_check(element);
        }

    }
    return true;
}

///////////////////End of object inputFile///////////////////








/************************************************************
*    Object: Check_EventTime. Use this object to make sure
*    that the end time is not before the start time, confirm pastdue time,
*    check duration of the event.
*************************************************************/

var Check_EventTime_check;

function Check_EventTime(obj)
{
    this.start      = "bbDomUtil.getInputElementByName('"+obj.name+"')";
    this.end        = "bbDomUtil.getInputElementByName('"+obj.cmp_field+"')";
    //restrict flags fields
    this.restrict   = "bbDomUtil.getInputElementByName('"+obj.restrict_flag+"')";
    this.cmp_restrict="bbDomUtil.getInputElementByName('"+obj.cmp_restrict_flag+"')";

    this.ref_lbl    = obj.ref_label;
    this.cmp_ref_lbl= obj.cmp_ref_label;
    this.notEqual   = obj.duration;
    this.pastDue    = obj.past_due;
    this.show_end_time = obj.show_end_time;
    // define method
    this.check      = Check_EventTime_check;
}

function Check_EventTime_check()
{
    var start, end, restr, cmp_restr;
    start = eval(this.start);     // first datetime field
    end   = eval(this.end);         // second datetime field to be compared with first
    restr = eval(this.restrict);    // Restrict checkbox field
    cmp_restr = eval(this.cmp_restrict);  // Restrict checkbox field to compare to
    restr     = (typeof(restr)     != 'undefined') ? restr.checked : true;      // True if restrict checkbox
    cmp_restr = (typeof(cmp_restr) != 'undefined') ? cmp_restr.checked : true;  // is checked or not defined

    // Update time in hidden field
    // Set time to empty string if it is not restricted
    if ( !restr )
    {
        start.value = '';
    }
    if ( !cmp_restr || (this.show_end_time && !restr) )
    {
        end.value   = '';
    } // Second field has to be set also
    start = start.value;
    if ( typeof end != 'undefined' )
    {
        end = end.value;
    }
    // Do not compare fields if at least one checkbox is unchecked
    if ( !restr || !cmp_restr )
    {

        this.notEqual = 0;
    }
    // Do not test for past due if restiction is not applied

    if ( !restr )
    {
        this.pastDue = 0;
    }
    if ( this.pastDue )
    {
        var confirm;
        var start_ms = Date.parse(start.replace(/-/g,'/'));
        if ( start_ms < Date.parse(new Date())-this.pastDue*1000*60 )
        {
            if ( !window.confirm(JS_RESOURCES.getFormattedString('validation.date_past.confirm', [this.ref_lbl])) )
            {
                return false;
            }
        }
    }
    if ( (document.forms[0].restrict_start && document.forms[0].restrict_end)||
         (document.forms.length > 1 && document.forms[1].restrict_start && document.forms[1].restrict_end) )
    {
        if ( (document.forms[0].restrict_start && document.forms[0].restrict_end && document.forms[0].restrict_start.checked && document.forms[0].restrict_end.checked) ||
             (document.forms.length > 1 && document.forms[1].restrict_start && document.forms[1].restrict_end && document.forms[1].restrict_start.checked && document.forms[1].restrict_end.checked) )
        {
            if ( start > end && this.notEqual )
            {
                alert(JS_RESOURCES.getFormattedString('validation.date_past',
                                                      [this.cmp_ref_lbl, this.ref_lbl]));
                return false;
            }
            else if ( end == start && this.notEqual )
            {
                alert(JS_RESOURCES.getFormattedString('validation.date_equal',
                                                      [this.cmp_ref_lbl, this.ref_lbl]));
                return false;
            }
        }
    }
    else
    {
        if ( start > end && this.notEqual )
        {
            alert(JS_RESOURCES.getFormattedString('validation.date_past',
                                                  [this.cmp_ref_lbl, this.ref_lbl]));
            return false;
        }
        else if ( end && end == start && this.notEqual )
        {
            alert(JS_RESOURCES.getFormattedString('validation.date_equal',
                                                  [this.cmp_ref_lbl, this.ref_lbl]));
            return false;
        }
    }
    return true;
}
/*
 * SCR  17696
 * This validation check should be used in the date widgets instead of the earlier one
 * as that has the chackboxes names hardcoded in them. The existing date wodgets
 * use it, but going ahead this should be the used. It helps specially when there are
 * multiple date widgets on the same page.
*/
var Check_EventTime_check_multiple;

function Check_EventTime_multiple(obj)
{
    this.start      = "bbDomUtil.getInputElementByName('"+obj.name+"')";
    this.end        = "bbDomUtil.getInputElementByName('"+obj.cmp_field+"')";
    //restrict flags fields
    this.restrict   = "bbDomUtil.getInputElementByName('"+obj.restrict_flag+"')";
    this.cmp_restrict="bbDomUtil.getInputElementByName('"+obj.cmp_restrict_flag+"')";

    this.ref_lbl    = obj.ref_label;
    this.cmp_ref_lbl= obj.cmp_ref_label;
    this.notEqual   = obj.duration;
    this.pastDue    = obj.past_due;
    this.show_end_time = obj.show_end_time;
    // define method
    this.check      = Check_EventTime_check_multiple;
}

function Check_EventTime_check_multiple()
{
    var start, end, restr, cmp_restr;
    start = eval(this.start);       // first datetime field
    end   = eval(this.end);         // second datetime field to be compared with first
    restr = eval(this.restrict);    // Restrict checkbox field
    cmp_restr = eval(this.cmp_restrict);  // Restrict checkbox field to compare to
    restr     = (typeof(restr)     != 'undefined') ? restr.checked : true;      // True if restrict checkbox
    cmp_restr = (typeof(cmp_restr) != 'undefined') ? cmp_restr.checked : true;  // is checked or not defined

    // Update time in hidden field
    // Set time to empty string if it is not restricted
    if ( !restr )
    {
        start.value = '';
    }
    if ( !cmp_restr || (this.show_end_time && !restr) )
    {
        end.value   = '';
    } // Second field has to be set also
    start = start.value;
    if ( typeof end != 'undefined' )
    {
        end = end.value;
    }
    // Do not compare fields if at least one checkbox is unchecked
    if ( !restr || !cmp_restr )
    {

        this.notEqual = 0;
    }
    // Do not test for past due if restiction is not applied

    if ( !restr )
    {
        this.pastDue = 0;
    }
    if ( this.pastDue )
    {
        var confirm;
        var start_ms = Date.parse(start.replace(/-/g,'/'));
        if ( start_ms < Date.parse(new Date())-this.pastDue*1000*60 )
        {
            if ( !window.confirm(JS_RESOURCES.getFormattedString('validation.date_past.confirm', [this.ref_lbl])) )
            {
                return false;
            }
        }
    }
    if ( restr && cmp_restr )
    {
        //This block has been aded due to SCR 17696.
        //Reason : if this method is directly called from a JSP page which is not a part of
        // the existing date widgets, and the parameters of stsrt date, end date, start checkbox and
        // end checkbox are passed, and additionally the page has another
        if ( start > end && this.notEqual )
        {
            alert(JS_RESOURCES.getFormattedString('validation.date_past',
                                                  [this.cmp_ref_lbl, this.ref_lbl]));
            return false;
        }
        else if ( end == start && this.notEqual )
        {
            alert(JS_RESOURCES.getFormattedString('validation.date_equal',
                                                  [this.cmp_ref_lbl, this.ref_lbl]));
            return false;
        }
    }
    return true;
}

/*We always need time in our favorite format
*/
function sql_datetime(dat)
{
    var year = dat.getFullYear();
    var mon  = dat.getMonth();
    mon++;                      mon = (mon<10)?'0'+mon:mon;
    var day = dat.getDate();    day = (day<10)?'0'+day:day;
    var hh      = dat.getHours();   hh  = (hh<10)?'0'+hh:hh;
    var mi      = dat.getMinutes(); mi  = (mi<10)?'0'+mi:mi;
    var ss      = dat.getSeconds(); ss  = (ss<10)?'0'+ss:ss;
    return  year+'-'+mon+'-'+day+' '+hh+':'+mi+':'+ss;
}
///////////////////End of object Check_EventTime/////////////



/********************************************************************************
* doubleSubmit.checkDoubleSubmit()
* doubleSubmit.registerFormSubmitEvents(...)
* doubleSubmit.handleFormSubmitEvents(...)
* doubleSubmit.allowSubmitAgainForForm(...) : call to enable submitting the form again / use when you need to submit a form multiple times on a page
* All form submissions should do this validation to avoid double submits.
* All secure form submissions must do this validation to avoid multiple submits
* of the same nonce.
*
* ***** This validation is done automatically on all form submits. *****
* NOTE : Do not overwrite form.onsubmit() function on the form. Instead, call
* doubleSubmit.registerFormSubmitEvents(...) function to add any validation routine that
* you want to add on the page. The callback function should return either true or false;
* Ex)
*   doubleSubmit.registerFormSubmitEvents( formElement, function(event)
*   {
*     // Your validation logic you would have otherwise overwritten form.onsubmit() with
*     return true/false;
*   });
*********************************************************************************/
var doubleSubmit ={};
/*event is null when this function is called programatically by form.submit()
 *so, if you are stopping an event, you need to first check if event is available in the context or not
 *if event is not available, returning false is good enough.
*/
doubleSubmit.checkDoubleSubmit = function ( event, formName )
{
  var currentTime = new Date().getTime();

  if ( !doubleSubmit.submissionFlagLookup )
  {
    // a map-like array (form identifier -> time stamp) to keep track of form submissions
    doubleSubmit.submissionFlagLookup = {};
    doubleSubmit.submissionFlagLookup[ formName ] = currentTime;
    if(event)
    {
      event.returnValue = true;
    }
    return true;
  }

  if ( !doubleSubmit.submissionFlagLookup[ formName ] )
  {
    doubleSubmit.submissionFlagLookup[ formName ] = currentTime;
    if(event)
    {
      event.returnValue = true;
    }
    return true;
  }

  if ( ( currentTime - doubleSubmit.submissionFlagLookup[ formName ] ) < 10000 )
  {
    // we will just ignore subsequent clicks on the submission button for 10 seconds since the first one
  }
  else
  {
    // 10 seconds has passed since the first click on the submission button. yes it's taking longer than optimal but
    // just pop up an alert box saying submission has gone through so be patient and wait!!
    alert( JS_RESOURCES.getString( 'notification.submit' ) );
  }
  if(event)
  {
    event.stop();
  }
  return false;
};

/*event and originalFormOnSubmit are null when this function is called programatically by form.submit()
 *so, if you are stopping an event, you need to first check if event is available in the context or not
 *if event is not available, returning false is good enough.
*/
doubleSubmit.handleFormSubmitEvents = function ( event, form, originalFormOnSubmit )
{
  if(originalFormOnSubmit)
  {
    if(originalFormOnSubmit.call(form) == false)
    {
      if(event)
      {
        event.returnValue = false;
        event.stop();
      }
      return false;
    }
  }
  if (event && event.stopped)
  {
    // in some places, we just stop the event and don't return false on onsubmit call.
    // Besides, if the submit event has been stopped, we need/should not go any further.
    event.returnValue = false;
    return false;
  }

  var i=0;
  if (doubleSubmit.responders)
  {
    while (doubleSubmit.responders[i])
    {
      if (form === doubleSubmit.responders[i].form)
      {
        if(doubleSubmit.responders[i].responder.call(form,event) == false)
        {
          if(event)
          {
            event.returnValue = false;
            if(!event.stopped) //event could have already been stopped in the above responder function call
            {
              event.stop();
            }
          }
          return false;
        }
        if (event && event.stopped)
        {
          // in some places, we just stop the event and don't return false on onsubmit call.
          // Besides, if the submit event has been stopped, we need/should not go any further.
          event.returnValue = false;
          return false;
        }
      }
      i++;
    }
  }
  doubleSubmit._obtainFormNameFromFormIdIfDesirable( form );
  return doubleSubmit.checkDoubleSubmit( event, form.name );
};

doubleSubmit.registerFormSubmitEvents = function ( form, responder )
{
  if ( !doubleSubmit.responders )
  {
    doubleSubmit.responders = {};
  }

  var i=0;
  while ( doubleSubmit.responders[i] )
  {
    i++;
  }
  doubleSubmit.responders[i] = {};
  doubleSubmit.responders[i].form = form;
  doubleSubmit.responders[i].responder = responder;
  return;
};

doubleSubmit.allowSubmitAgainForForm = function ( form )
{
  if ( !doubleSubmit.submissionFlagLookup )
  {
    return;
  }

  form.name = doubleSubmit._obtainFormNameFromFormIdIfDesirable( form );
  delete doubleSubmit.submissionFlagLookup[ form.name ];
  return;
};

doubleSubmit._obtainFormNameFromFormIdIfDesirable = function ( form )
{
  // if name property of the form is not defined or an empty string, then get it from id hoping that it is something more useful
  if(!form.name || form.name === "")
  {
    if(form.id)
    {
      form.name = form.id;
    }
  }
  return form.name;
};
////////////End of namespace doubleSubmit///////////



/********************************************************************************
* Object RadioCheckBox():
* Use this object to make sure that at least one item is selected from the group of
* radio/checkbox groups. Just attach this code to checkbox/radio group (refered below as 'element'):
* formCheckList.addElement(new RadioCheckBox({name:'element or subgroup name',group:'group name',ref_label:"group label in alerts"}));
*********************************************************************************/
var groupAddElement, checkGroupChecked, groupIsChecked;

// Constructor function
function RadioCheckBox(h)
{
    return h;
}

function CheckGroup(h)
{
    this.name       = h.group;
    this.ref_label  = h.ref_label;
    this.elements   = [];
    this.addElement = groupAddElement;
    this.check      = checkGroupChecked;
}

function groupAddElement(h)
{
    this.elements[this.elements.length]   = h.name;
}

function checkGroupChecked()
{
    var list = this.elements;
    var chk  = false;
    for ( var i = 0; i < list.length; i++ )
    {
        if ( groupIsChecked(list[i]) )
        {
            return true;
        }
    }

    var msg = null;
    var group = bbDomUtil.getInputElementByName(list[0]);
    group = (typeof group[0] != 'undefined') ? group[0]:group;

    if ( group.type == "radio" )
    {
        msg = JS_RESOURCES.getFormattedString('validation.radio.required', [this.ref_label]);
    }
    else
    {
        msg = JS_RESOURCES.getFormattedString('validation.option.required', [this.ref_label]);
    }

    alert(msg);
    group.focus();
    return false;
}

function groupIsChecked(groupName)
{
    var group = eval('bbDomUtil.getInputElementByName("'+groupName+'")');
    var checked = false;
    if ( typeof group != 'undefined' )
    {
        if ( group.length  > 1 )
        {
            for ( var i=0;i< group.length; i++ )
            {
                if ( group[i].checked )
                {
                    checked = true;
                    return checked;
                }
            }
        }
        else
        {
            if ( group.checked )
            {
                checked = true;
                return checked;
            }
        }
    }
    return checked;
}
///////////////////End of Object CheckGroup()////////////////////







/********************************************************************************
* Object selector():
* Use this object to make sure that at least one item is available in the Selector element (see PickerElement.java)
* For use when Selector is marked Required:
* formCheckList.addElement(new CheckSelector({name:'element or subgroup name',ref_label:"group label in alerts"}));
*********************************************************************************/
var selectorCheck, selectorElementAvailable;

// Constructor function
function selector(h)
{

    this.element        = 'bbDomUtil.getInputElementByName("'+h.name+'")';
    this.fieldName      = h.name;
    this.ref_label      = h.ref_label;

    this.custom_alert     = h.custom_alert;
    this.custom_alert_cmp = h.custom_alert_cmp;

    this.required       = h.required;
    this.check          = selectorCheck;

    // Add here anything you need to validate
}

// Do actual check here
function selectorCheck()
{
  if(this.required)
  {
    var isAvailable = selectorElementAvailable(this.fieldName);
    this.custom_alert     = (typeof this.custom_alert     != 'undefined') ? this.custom_alert     : '';
    this.ref_label = (typeof this.ref_label != 'undefined') ? this.ref_label
    : JS_RESOURCES.getFormattedString('field_name.substitute', [this.element.name]);
    if ( !isAvailable )
    {
      alert(this.custom_alert ? this.custom_alert
              : JS_RESOURCES.getFormattedString('validation.required', [this.ref_label]));
      return false;
    }
  }
  return true;
}

function selectorElementAvailable(groupName)
{
    // we need at least one "Remove" checkbox to be present and unchecked (one element is added but not removed)
    var group = eval('bbDomUtil.getInputElementByName("'+groupName+'")');
    var available = false;
    if ( typeof group != 'undefined' && group !== null)
    {
        if ( group.length  > 1 )
        {
            for ( var i=0;i< group.length; i++ )
            {
                if ( !group[i].checked )
                {
                    available = true;
                    return available;
                }
            }
        }
        else
        {
            if ( !group.checked )
            {
                available = true;
                return available;
            }
        }
    }
    return available;
}
///////////////////End of Object CheckSelector()////////////////////




//////////////// Start some useful generic functions ////////////


/*  Function ltrim(): Remove leading  spaces in strings:
    Usage:trimmedString = originalString.ltrim();
*/
function ltrim()
{
    return this.replace( /^\s+/g,'');
}
String.prototype.ltrim = ltrim;

/*  Function rtrim(): Remove trailing spaces in strings:
    Usage:trimmedString = originalString.rtrim();
*/
function rtrim()
{
    return this.replace( /\s+$/g,'');
}
String.prototype.rtrim = rtrim;


/*  Function trim(): Remove leading and trailing spaces in strings:
    Usage:trimmedString = originalString.trim();
*/
function trim()
{
    return this.rtrim().ltrim();
}
String.prototype.trim = trim;

/* Function invalidChars(): Returns an array of illegal chars
   Usage: var listOfChars = myStringToSearch.invalidChars(regularExpression);
   regularExpression = /[illegal chars]/g; Sample re = /[! &^$#]/g
*/
function invalidChars (re)
{
    var chrs = this.match(re);
    if ( chrs )
    {
        for ( var j=0;j<chrs.length;j++ )
        {
            if ( chrs[j]===' ' )
            {
                chrs[j]=JS_RESOURCES.getString('invalid_char.space');
            }
            else if ( chrs[j]==',' )
            {
                chrs[j]=JS_RESOURCES.getString('invalid_char.comma');
            }
            else if ( chrs[j]=='\\' )
            {
                chrs[j]='\\\\';
            }
        }
    }
    return chrs;
}
String.prototype.invalidChars = invalidChars;

/** Function getRadioValue(): Returns selected value for group of radio buttons
* Usage: var selectedValue = getRadioValue(radio); radio - reference to radio group
*/
function getRadioValue(radio)
{
    for ( var i=0;i< radio.length;i++ )
    {
        if ( radio[i].checked )
        {
            return radio[i].value;
        }
    }
}

/** Function isEmptyWysiwyg(): Checks WYSIWYG control for value
*/
function isEmptyWysiwyg(field)
{
    // first remove any HTML tags from the value, then check if it's empty (all spaces or &nbsp;s)
    // explicitly adding the unicode non-breaking space and line feed/break since IE and safari
    // don't seem to include them in \s
    var EMPTY_REGEXP = /^(\s|\u00A0|\u2028|\u2029|&nbsp;)*$/i;
   // Input is not empty if it contains one of the following tags: img/object/embed
    var SPECIALTAGS = /(<\s*(img)|(object)|(embed)|(hr)|(input)|(applet))/i;
    if ( field && typeof(field.value) == 'string' && field.value )
    {
        var notags = field.value.replace(/<.*?>/g,'');
        var result = EMPTY_REGEXP.test(notags);

        return  ( result && !SPECIALTAGS.test(field.value) );

    }
    return true;
}

/** Function isValidUrl(): Checks if given string is in the general URL format
*/
var VALID_URL_REGEXP = /[a-z]+:\/\/[^:\/]+(:[0-9]+)?\/?.*/;
function isValidUrl(string)
{
    return( VALID_URL_REGEXP.test(string) );
}

/** Numeric
*/
var EFLOAT_REGEXP = LOCALE_SETTINGS.getString('efloat.format');
var THOUSANDS_SEP = LOCALE_SETTINGS.getString('thousand.sep.format');
/*rejectThousandSep: if true then the presence of the thousands-separator is an error (non-numeric)
 * e.g. we don't accept it for point, since point/score is rarely in thousands range.
 */
function isNumeric(string, rejectThousandSep )
{
    string = string.trim();
    if ( rejectThousandSep !== null && rejectThousandSep )
    {
      var hasThousands = ( string.search( new RegExp( THOUSANDS_SEP ) ) !== -1 ) ;
      if (hasThousands)
      {
        return false;
      }
    }
    string = string.replace(new RegExp(THOUSANDS_SEP, 'g'), '');
    if ( string.search( new RegExp(EFLOAT_REGEXP) ) === 0 )
    {
        var floatValue = parseFloat(string);
        return !isNaN(floatValue);
    }
    return false;
}

var MAX_POINTS_DECIMAL_DIGITS = 5;  // Please keep this in sync with the constants in GradeFormat.java.
function validPointsDecimalPlaces( value )
{
    if (!value || value == "0" || value == "-")
    {
        return true;
    }
    var val = '' +value;
    var decimal = (typeof LOCALE_SETTINGS === 'undefined' || LOCALE_SETTINGS.getString('number_format.decimal_point') === null ) ? '.' : LOCALE_SETTINGS.getString('number_format.decimal_point');
    var idx = val.indexOf( decimal );
    if (idx > -1 && (val.length - idx - 1) > MAX_POINTS_DECIMAL_DIGITS)
    {
        return false;
    }
    else
    {
        return true;
    }
}

/** Float between 0 and 100
*/
var FLOAT_REGEXP = LOCALE_SETTINGS.getString('float.format');
function isPercent(string)
{
    string = string.trim();
    if ( string.search( new RegExp(FLOAT_REGEXP) ) === 0 )
    {
        var floatValue = parseFloat(string);
        return( !isNaN(floatValue)  && floatValue >= 0 && floatValue <= 100 );
    }
    return false;
}

/** Float between -100 and 100
*/
var FLOAT_ALLOW_NEGATIVE_REGEXP = LOCALE_SETTINGS.getString('float.allow.negative.format');
function isValidNegativePercent(string)
{
    string = string.trim();
    if ( string.search( new RegExp(FLOAT_ALLOW_NEGATIVE_REGEXP) ) === 0 )
    {
        var floatValue = parseFloat(string);
        return( !isNaN(floatValue)  && floatValue >= -100 && floatValue <= 100 );
    }
    return false;
}

/*Function submitForm()
  Call this function to validate and submit form
  @param form the name of the form or the DOM object representing the form. If null or undefined, submits first form on page.
*/
function submitForm(form)
{
    if ( validateForm() )
    {
        if (form)
        {
          if ( typeof( form ) == "string" )
          {
              document.forms[ form ].submit();
          }
          else
          {
              form.submit();
          }
        }
        else
        {
          document.forms[0].submit();
        }
    }
}

/* Sort numerical array  in ascending order
*/
function numericalArraySortAscending(a, b)
{
  return (a-b);
}


/*Function validateForm()
* Call this function onSubmit inside <form> tag
*/
function validateForm()
{
    // Set textarea value to VTBE contents
    if ( typeof(finalizeEditors) == "function" )
    {
        finalizeEditors();
    }

    var ismath = window.api ? true : false; // True if webeq is there

    /* Transform equations place holders into html before validation */
    if ( ismath )
    {
        api.setHtml();
    }

    if ( skipValidation )
    {
        return true;
    }

    /* Validate form */
    var valid = formCheckList.check();
    var i;

    /*Check for invalid answers if any present */
    var invalidAnswersArray = [];
    var invAns = window.invalidAnswers;
    if ( typeof( invAns) == 'object' && invAns.length > 0 )
    {
        for ( i = 0; i < invAns.length; ++i )
        {
            invalidAnswersArray.push( invAns[i] );
        }
    }
    invAns = window.invalidAnswersTmp;
    if ( typeof(invAns) == 'object' && invAns.length > 0 )
    {
        for ( i = 0; i < invAns.length; ++i )
        {
            invalidAnswersArray.push( invAns[i] );
        }
    }
    var stringArg = '';
    if ( invalidAnswersArray.length > 0 )
    {
        invalidAnswersArray.sort(numericalArraySortAscending);
        var lastIndex = invalidAnswersArray.length - 1;
        for ( var x = 0; x < invalidAnswersArray.length; x++ )
        {
            stringArg += invalidAnswersArray[x];
            if ( x < lastIndex )
            {
                if ( ( (x+1) % 10 ) === 0 )
                {
                    stringArg += ",\n";
                }
                else
                {
                    stringArg += ",";
                }
            }
        }
    }
    if ( stringArg !== '' && valid )
    {
        var msgKey;
        if ( !assessment.backtrackProhibited )
        {
          msgKey = 'assessment.incomplete.confirm';
        }
        else
        {
          msgKey = 'assessment.incomplete.confirm.backtrackProhibited';
        }
        if (assessment.isSurvey)
        {
          msgKey = msgKey + ".survey";
        }

        if ( !confirm( JS_RESOURCES.getFormattedString( msgKey, [stringArg] ) ) )
        {
            valid = false; // User decided not to submit
        }
        else
        {
          assessment.userReallyWantsToSubmit = true;
        }

        window.invalidAnswersTmp = []; // Clearing up
    }

    /* Go back to placeholders if validation failed (valid == false) */
    if ( ismath && !valid )
    {
        api.setMathmlBoxes();
    }

    return valid;
}

/*Function boxSelector()
* Use this function to select, unselect or invert selection for specified checkbox groups
* Call: boxSelector(['name1','name2',...,'namen'],action), here action is 'select', or 'unselect', or 'invert'
*/
function boxSelector(list,action)
{
    action = (action == 'select') ? true : (action == 'unselect') ? false : action;
    for ( var i=0;i<list.length;i++ )
    {
        var group = 'bbDomUtil.getInputElementByName("'+list[i]+'")';
        if ( typeof (group = eval(group)) != 'undefined' )
        {
            var j;
            if ( action == 'invert' )
            {
                for ( j=0;j<group.length;j++ )
                {
                    group[j].checked = !group[j].checked;
                }
            }
            else
            {
                for ( j=0;j<group.length;j++ )
                {
                    group[j].checked = action;
                }
            }
        }
    }
}


function setHidden (from,to)
{
    var hide = eval(to);
    hide.value = from.value;
}


//////////////////////////////////////////////////////////////////
/**
* Check_Answer object was added by request specified in mscr 524
* to provide validation to student answers
* Variable invalidAnswers has to be added to the page where assessment is submitted
* It should contain the list of unfinished questions excluding  question(s) on current page
* Check_Answer object will perform final validation and display all unfinished questions in confirm box
*/

var invalidAnswers = []; // the java code will populate this array on final QbyQ page
/** Object constructor for answers walidation
*
*/

var Check_Answer_check;

function Check_Answer (vobj)
{
    if ( typeof(window.invalidAnswersTmp)=='undefined' )
    {
        window.invalidAnswersTmp=[];
    }
    this.form       = 'document.getElementById("bb-take-assessment")';
    this.element    = 'bbDomUtil.getInputElementByName("'+vobj.name+'")';
    this.name       = vobj.name;
    this.answerChk  = true; //Check_Answer is special check, it makes a list of unfinished questions and always return true
    this.ref_label  = vobj.ref_label;
    this.check      = Check_Answer_check;
}

//Test if at least one member of radio or checkbox group is selected
function isChecked(grp)
{
  if (typeof(grp.length) != 'undefined')
  {
    for ( var i=0;i< grp.length;i++ )
    {
        if ( grp[i].checked )
        {
            return true;
        }
    }
    return false;
  }
  else
  {
    return grp.checked;
  }
}

function Check_Answer_check()
{

    //create form element object
    var el = eval(this.element);

    //Extract question type information from element name
    var qtype =  /^(\w+)-/.exec(this.name);
    if ( !qtype )
    {
        qtype =  /^([^_]+)_/.exec(this.name);
    }
    qtype = qtype[1];
    if ( qtype == 'ma' )
    {
        qtype = /-\d+$/.test(this.name) ? 'mat' : 'ma';
    }

    // Perform actual check-up
    if ( qtype == 'tf' || qtype == 'mc' || qtype == 'ma' || qtype == 'eo' )
    {
        if ( !isChecked(el) )
        {
            window.invalidAnswersTmp[window.invalidAnswersTmp.length]=this.ref_label;
        }
    }
    else if ( qtype == 'ord' || qtype == 'mat' )
    {
        if ( el.selectedIndex === 0 && this.ref_label != window.invalidAnswersTmp[window.invalidAnswersTmp.length-1] )
        {
            window.invalidAnswersTmp[window.invalidAnswersTmp.length]= this.ref_label;
        }
    }
    else if ( qtype == 'fitb' || qtype == 'essay' || qtype == 'num' || qtype == 'calc' || qtype == 'hs' || qtype == 'jumbled_sentence' || qtype == 'fib_plus' || qtype == 'quiz_bowl' )
    {
        //remove isEmptyWysiwyg for these question types, since they should allow some chars as < >
        var val = el.value;
        if ( isAnEmptyVtbe(val) )
        {
          val='';
        }
        if ( val.trim().length < 1 )
        {
            window.invalidAnswersTmp[window.invalidAnswersTmp.length]= this.ref_label;
        }
        // LRN-LRN-74079 strip all spaces in calculated formula question answers, so numbers can be parsed correctly
        if ( qtype == 'calc' )
        {
          el.value = val.replace(/ /g, "");
        }
    }
    else if ( qtype == 'file' )
    {
        var haveFile = false;

        var hiddenField = eval(this.form + '.elements["' + this.name + '-override"]');
        if ( hiddenField && hiddenField.value == "true" )
        {
            haveFile = true;
        }

        el = eval(this.form + '.elements["' + this.name + '_attachmentType"]');
        if ( !haveFile && el && el.value !== "" )
        {
            haveFile = true;
        }

        if ( !haveFile )
        {
            window.invalidAnswersTmp[window.invalidAnswersTmp.length]= this.ref_label;
        }
    }

    // eliminate duplicates
    // TODO: think of a better way to do this
    if ( window.invalidAnswersTmp.length > 0 )
    {
        var tmpArray = [];
        var tmpObject = {};
        for ( var i = 0; i < window.invalidAnswersTmp.length; ++i )
        {
            if ( !tmpObject[window.invalidAnswersTmp[i]] )
            {
                tmpObject[window.invalidAnswersTmp[i]] = true;
                tmpArray[tmpArray.length] = window.invalidAnswersTmp[i];
            }
        }
        window.invalidAnswersTmp = tmpArray;
    }

    return true; //Always true, we can make decision later through confirm
}

// wrapper function for focus() calls
function shiftFocus(el, isVTBE)
{
    if ( el )
    {
      if ( isVTBE && editors && editors[el.name] && typeof(editors[el.name].focusEditor) == 'function' )
      {
        editors[el.name].focusEditor();
      }
      else if ( !el.disabled && !el.readOnly && el.type != "hidden" )
      {
        safeFocus( el );
      }
    }
    return;
}

function safeFocus( e )
{
  try
  {
    if ( e && e.focus )
    {
      e.focus();
    }
  }
  catch (er)
  {
    //Ignore, element is hidden in IE and can't be focused.
  }
}

/**
 * A validator that checks to see that a certain radio button in a group is
 * selected.  This is intended to be used for conditional validation --
 * validators that only apply when a certain radio button selection is made.
 * Note that if there are no selected values, this validator will return false
 * when checked.
 *   - name - radio button group to check
 *   - value - the radio button value to check for selection
 */
var RadioButtonValueValidator_check;

function RadioButtonValueValidator( name, value )
{
    this.element = bbDomUtil.getInputElementByName(name);
    this.value = value;
    this.check = RadioButtonValueValidator_check;
}

function RadioButtonValueValidator_check()
{
    for ( var i = 0; i < this.element.length; i++ )
    {
        if ( this.element[i].value == this.value )
        {
            return this.element[i].checked;
    }
    }
    return false;
}

/**
 * A validator that performs a logical, short-circuit OR on its two arguments.
 */
var OrValidator_check;

function OrValidator( first, second )
{
    this.first = first;
    this.second = second;
    this.check = OrValidator_check;
}

function OrValidator_check()
{
    return this.first.check() || this.second.check();
}

/* This is a sample code that has to be added to every corresponding form element in take assessment page,
where you perform question validation for completness;
ref_lablel value is used to refer to element, name is field full name:

<script type="text/javascript">
formCheckList.addElement(new Check_Answer({ref_label:"Question 3",name:"tf-ans-_190_1"}));
</script>

*/

var nonceUtil = {};

/**
 * Finds the form element holding the nonceId
 * @param formId is the id of the form the nonce element exists within
 */
nonceUtil.getNonceId = function(formId)
{
  return nonceUtil.getNonceIdEx(formId, 'blackboard.platform.security.NonceUtil.nonce')
};

nonceUtil.getAjaxNonceId = function(formId)
{
  return nonceUtil.getNonceIdEx(formId, 'blackboard.platform.security.NonceUtil.nonce.ajax')
};

nonceUtil.getNonceIdEx = function(formId, elName)
{
  var nonceId = null;
  if(formId && $s(formId) )
  {
    nonceId= $s(formId).elements[elName];
  }
  if( !nonceId )
  {
   // take a cheap shot at retreiving the first nonceId on the page
   nonceId = document.getElementsByName( elName )[0];
  // Note : nonceId can be null if the form does not have a nonce element declared. This should be a sign of a xsrf loophole
  }
  return nonceId;
};

/**
 * Finds the form element holding the nonceId
 * @param formElementId is the id of a form element on the page. It is expected that the nonceId corresponds
 * to the same form.
 */
nonceUtil.getNonceIdByFormElementId = function(formElementId)
{
  var nonceId = null;
  if( formElementId &&  $s(formElementId) )
  {
    var elementFormId = bbDomUtil.getEnclosingForm(formElementId);
    nonceId = $s(elementFormId).elements['blackboard.platform.security.NonceUtil.nonce'];
  }
  return nonceId;
};

nonceUtil.getNonceIdValue = function(formId)
{
  var nonceId = nonceUtil.getNonceId(formId);
  return nonceId ? nonceId.value : "";
};

/**
 * Copies the nonceid from one form on the page to another form.  Useful when using flyout forms.
 */
nonceUtil.copyNonceId = function( sourceFormId, targetFormId )
{
  var nonceId = nonceUtil.getNonceIdValue( sourceFormId );
  var targetElem = new Element( 'input',
                                { type: 'hidden',
                                  name: 'blackboard.platform.security.NonceUtil.nonce',
                                  value: nonceId } );
  $( targetFormId ).appendChild( targetElem );
};

/**
 * Updates the form's nonceId based on the JSON response from an AjaxSecureForm
 */
nonceUtil.updateFromAjaxRequest = function( headerJSON )
{
  if ( headerJSON )
  {
    var nonceId = nonceUtil.getNonceId();
    if( nonceId )
    {
      nonceId.value = headerJSON.nonceId;
    }
  }
};
var NumberLocalizer = Class.create();

// Unit tests for this class are located in workspace/b2/grading/src/test/resources/blackboard/webapps/gradebook2/js/NumberLocalizerJSTest.html
// and run from NumberLocalizerJSTest.java
NumberLocalizer.prototype =
{
    DEFAULT_SCORE_MAX_FRACTION_DIGITS : 5, // Corresponds to GradeFormat.MAX_SCORE_DISPLAY_SCALE
    DEFAULT_SCORE_MIN_FRACTION_DIGITS : 2, // Corresponds to GradeFormat.MIN_SCORE_DISPLAY_SCALE
    DEFAULT_POINTS_MAX_FRACTION_DIGITS : 5, // Corresponds to GradeFormat.MAX_POINTS_DISPLAY_SCALE
    DEFAULT_POINTS_MIN_FRACTION_DIGITS : 0, // Corresponds to GradeFormat.MIN_POINTS_DISPLAY_SCALE
    NUMBER_FORMAT_THOUSAND_SEPARATOR : 'number_format.thousands_sep',
    NUMBER_FORMAT_DECIMAL_SEPARATOR : 'number_format.decimal_point',
    DEFAULT_THOUSAND_SEPARATOR : ',',
    DEFAULT_DECIMAL_SEPARATOR : '.',

    initialize : function()
    {
      this.thousandsSeparator = this._getSafeSeparator( this.NUMBER_FORMAT_THOUSAND_SEPARATOR, this.DEFAULT_THOUSAND_SEPARATOR );
      this.needToConvertThousands =  this.thousandsSeparator !== this.DEFAULT_THOUSAND_SEPARATOR;

      this.decimalSeparator = this._getSafeSeparator( this.NUMBER_FORMAT_DECIMAL_SEPARATOR, this.DEFAULT_DECIMAL_SEPARATOR );
      this.needToConvertDecimal =  this.decimalSeparator !== this.DEFAULT_DECIMAL_SEPARATOR;
    },

    /**
     * Gets from LocaleSettings.properties configuration the value for the specified key, or a default separator if value for the key is not found.
     * @param key Name of the key.
     * @param defaultValue Default value to be returned.
     * @returns Value of the requested separator.
     */
    _getSafeSeparator : function ( key, defaultValue )
    {
      if ( typeof LOCALE_SETTINGS === 'undefined' || LOCALE_SETTINGS === null
           || LOCALE_SETTINGS.getString( key ) === undefined || LOCALE_SETTINGS.getString( key ) === null )
      {
        return defaultValue;
      }
      else
      {
        return LOCALE_SETTINGS.getString( key );
      }
    },

    formatScore : function ( num, doTruncate )
    {
      return this.formatNumberWithRoundingMode( num, this.DEFAULT_SCORE_MIN_FRACTION_DIGITS, this.DEFAULT_SCORE_MAX_FRACTION_DIGITS, doTruncate );
    },

    formatPoints : function ( num, doTruncate )
    {
      return this.formatNumberWithRoundingMode( num, this.DEFAULT_POINTS_MIN_FRACTION_DIGITS, this.DEFAULT_POINTS_MAX_FRACTION_DIGITS, doTruncate );
    },

    /**
     * Format and the given number with the specified fraction digits and rounding mode.
     *
     * @param num Number to format. If string, assume already localized.
     * @param minFractionDigits Minimum number of digits after the decimal place
     * @param maxFractionDigits Maximum number of digits after the decimal place
     * @param doTruncate If true, truncate the number if there are more than maxFractionDigits. Otherwise, round. Defaults to true.
     * @returns A localized formatted numeric string
     */
    formatNumberWithRoundingMode : function( num, minFractionDigits, maxFractionDigits, doTruncate )
    {
      //only parse if num is already localized (i.e. in string format)
      var numParsed = ( typeof num === "string" ) ? this.parseNumber( num ) : num;
      if( isNaN( numParsed ) )
      {
        return num.toString();
      }

      minFractionDigits = parseInt( minFractionDigits, 10 );
      maxFractionDigits = parseInt( maxFractionDigits, 10 );

      // if invalid minFractionDigits, assume min 0
      if( isNaN( minFractionDigits ) || minFractionDigits < 0 )
      {
        minFractionDigits = 0;
      }

      if( isNaN( maxFractionDigits ) )
      {
        var roundedToMin = numParsed.toFixed( minFractionDigits );
        if( parseFloat( roundedToMin ) === numParsed )
        {
          // toFixed only added trailing zeroes, so use this value
          return this.formatNumber( roundedToMin )
        }
        else
        {
          return this.formatNumber( numParsed );
        }
      }

      // If invalid range, min overrides max
      if( maxFractionDigits < minFractionDigits )
      {
        maxFractionDigits = minFractionDigits;
      }

      if( doTruncate === undefined )
      {
        doTruncate = true;
      }

      if( doTruncate )
      {
        return this._formatNumberTruncate( numParsed, minFractionDigits, maxFractionDigits );
      }
      else
      {
        return this._formatNumberRound( numParsed, minFractionDigits, maxFractionDigits );
      }

    },

    /**
     * Format and localize the given number, truncating if needed
     * @param num Number to format - must be of type Number
     * @param minFractionDigits Minimum number of digits after the decimal place. Non-optional, must be a non-negative Integer,
     *  less than or equal to maxFractionDigits
     * @param maxFractionDigits Maximum number of digits after the decimal place. If num has more than maxFractionDigits
     *  decimal places, the output will be truncated. Non-optional, must be a non-negative Integer, greater than or equal
     *  to minFractionDigits
     * @returns A localized formatted numeric string
     */
    _formatNumberTruncate : function(num, minFractionDigits, maxFractionDigits )
    {
      // Capture group 1: integer digits
      // 2: optional fractional part up to maxFractionDigits digits, with decimal point
      // 3 (contained in 2): optional fractional part up to maxFractionDigits digits, without decimal point
      if( maxFractionDigits === 0 || maxFractionDigits === 1 )
      {
        var re = new RegExp("^([-]?[\\d,]+)(\\.([1-9]))?");
      }
      else
      {
        var re = new RegExp("^([-]?[\\d,]+)(\\.(\\d{0," + (maxFractionDigits - 1) + "}[1-9]))?");
      }

      var splitRegexMatch = num.toString().match(re);

      if( !splitRegexMatch )
      {
        return this.formatNumber( num );
      }

      // Don't want fractional part, or don't need a fractional part and no fractional digits found
      if( maxFractionDigits === 0 || ( minFractionDigits === 0 && !splitRegexMatch[3] ) )
      {
        return splitRegexMatch[1] ? this.formatNumber(splitRegexMatch[1]) : "";
      }

      var integerPart = splitRegexMatch[1] ? splitRegexMatch[1] : "0";
      var fractionalPart = splitRegexMatch[3] ? splitRegexMatch[3] : "";

      if( fractionalPart.length < minFractionDigits )
      {
        var numZeroesToPad = minFractionDigits - fractionalPart.length;

        var padding = Array( numZeroesToPad + 1 ).join("0");

        fractionalPart = fractionalPart + padding;
      }

      return this.formatNumber( integerPart + "." + fractionalPart );
    },

    /**
     * Format and localize the given number, truncating if needed
     * @param num Number to format - must be of type Number
     * @param minFractionDigits Minimum number of digits after the decimal place. Non-optional, must be a non-negative Integer,
     *  less than or equal to maxFractionDigits
     * @param maxFractionDigits Maximum number of digits after the decimal place. If num has more than maxFractionDigits
     *  decimal places, the output will be rounded. Non-optional, must be a non-negative Integer, greater than or equal
     *  to minFractionDigits
     * @returns A localized formatted numeric string
     */
    _formatNumberRound : function(num, minFractionDigits, maxFractionDigits )
    {
      // Logic moved from gradebook_utils.js
      // now will try to get as little extra digits as needed, up to maxFractionDigits
      var roundBase = Math.pow( 10, minFractionDigits );
      var maxRoundBase = Math.pow( 10, maxFractionDigits );
      // LRN-170999 - Some floating points calculations have precision errors, when the last digit is 5 it can cause rounding
      // errors e.g. 1.255*100 = 125.49999999999999 -> round( 1.255, 2 ) = 1.25 instead of the right value 1.26
      // To avoid those errors use toFixed() to remove no-significant decimal places -> (1.255*100).toFixed(2) = 125.5
      var mostPreciseRounding = Math.round( ( num * maxRoundBase ).toFixed( maxFractionDigits ) ) / maxRoundBase;

      for ( var i = minFractionDigits; i < maxFractionDigits; ++i )
      {
        var floatRound = Math.round( ( num * roundBase ) ).toFixed( maxFractionDigits ) / roundBase;
        roundBase *= 10;
        if ( floatRound == mostPreciseRounding )
        {
          // adding any more digit will not add any more precision
          return this.formatNumber( num.toFixed( i ) );
        }
      }
      return this.formatNumber( mostPreciseRounding.toFixed( maxFractionDigits ) );
    },

    // Takes a number that is unlocalized and converts it to
    // the current locale format.
    formatNumber : function( f )
    {
      var result;
      result = f.toString();

      // Replace and thousands delimiter with a token so we can
      // replace it with the final symbol after we replace the decimal symbol.
      if ( this.needToConvertThousands )
      {
        result = result.replace( ',', '[comma]' );
      }

      if ( this.needToConvertDecimal )
      {
        result = result.replace( '.', this.decimalSeparator );
      }

      if ( this.needToConvertThousands )
      {
        result = result.replace( '[comma]', this.thousandsSeparator );
      }

      return result;
    },

    // Takes a number that is in the current locale format and
    // converts it back to an unlocalized number.
    parseNumber : function( num )
    {
      var result;
      result = num.toString();

      // Parsing string to return as a float, so we don't need the thousands
      // separator anymore.
      result = result.replace( this.thousandsSeparator, '' );

      if ( this.needToConvertDecimal )
      {
        result = result.replace( this.decimalSeparator, '.' );
      }

      return parseFloat( result );
    }
};
var popup =
{
  /**
   * Launches a new popup window.  This method is used for an random popup that
   * might be necessary (preview window for example).  If you are launching a
   * "picker" window you should use launchPicker() instead.
   *
   * @param url the url to open the new window using.  This is the first value
   *        passed to window.open().  This is required.
   * @param name the name of the  new window.  This is the second value passed
   *        to window.open().  This is required.
   * @param width the width of the window to launch.  If not provided a default
   *        value will be used.  Do not provide unless your specific requirements
   *        dictate it.
   * @param height the height of the window to launch.  If not provided a default
   *        value will be used.  Do not provide unless your specific requirements
   *        dictate it.
   * @param resizable whether the new window should be resizable.  If not
   *        provided a default value will be used.  Do not provide unless your
   *        specific requirements dictate it.
   * @param showStatus whether the new window should be show the status bar.  If
   *        not provided a default value will be used.  Do not provide unless
   *        your specific requirements dictate it.
   * @param scrolling whether the new window should allow scrolling.  If not
   *        provided a default value will be used.  Do not provide unless your
   *        specific requirements dictate it.
   * @return a reference to the popup window generated
   */
  launch: function( url, name, width, height, resizable, showStatus, scrolling )
  {
    if ( typeof( width ) == 'undefined' )
    {
      // for RTL, the width needs to be wider, to prevent vertical line overlapping in the popup
      if ( page.util.isRTL() )
      {
        width = 1050;
      }
      else
      {
        width = 1050;  // wide enough to prevent a horizontal scrollbar in most cases
      }
    }
    if ( typeof( height ) == 'undefined' )
    {
      height = 500;
    }
    if ( typeof( resizable ) == 'undefined' )
    {
      resizable = 'yes';
    }
    if ( typeof( showStatus ) == 'undefined' )
    {
      showStatus = 'yes';
    }
    if ( typeof( scrolling ) == 'undefined' )
    {
      scrolling = 'yes';
    }

    // figure out placement of the new window we will open.  If the desired size
    // of the new window is bigger than the screen size then make the window
    // smaller and put it far left.  Otherwise, center the window on screen.
    var screenX = 0;
    if ( screen.width <= width )
    {
      width = screen.width;  // new window should not be wider than the screen
    }
    else
    {
      screenX = ( screen.width - width ) / 2;  // center on the screen
    }

    var popup = window.open( url,
                             name,
                             'width=' + width +
                             ',height=' + height +
                             ',resizable=' + resizable +
                             ',scrollbars=' + scrolling +
                             ',status=' + showStatus +
                             ',top=20' +
                             ',screenY=20' +
                             ',screenX=' + screenX +
                             ',left=' + screenX );
    if ( popup )
    {
      popup.focus();
      if ( !popup.opener )
      {
        popup.opener = self;
      }

      window.top.name = 'bbWin';
    }

    return popup;
  },

  /**
   * Launches a new "picker" window.
   * <p>
   * At the moment the only difference between this method and launch (besides
   * the inability to specify some advanced and rarely used options) is that
   * this method will default the {@code name} value if not provided.  However,
   * you should still use this method if you are launching a "picker" type
   * window as additional differences may be introduced in the future.
   *
   * @param url the url to open the new window using.  This is the first value
   *        passed to window.open().  This is required.
   * @param name the name of the  new window.  This is the second value passed
   *        to window.open().  If not provided a default value will be used.
   * @param width the width of the window to launch.  If not provided a default
   *        value will be used.  Do not provide unless your specific requirements
   *        dictate it.
   * @param height the height of the window to launch.  If not provided a default
   *        value will be used.  Do not provide unless your specific requirements
   *        dictate it.
   * @return a reference to the picker window generated
   */
  launchPicker: function( url, name, width, height )
  {
    if ( typeof( name ) == 'undefined' )
    {
      name = 'picker';
    }

    return popup.launch( url, name, width, height );
  }
};
/**
 * Sets a Cookie with the given name and value.
 *
 * name       Name of the cookie
 * value      Value of the cookie
 * [expires]  Expiration date of the cookie (default: end of current session)
 * [path]     Path where the cookie is valid (default: path of calling document)
 * [domain]   Domain where the cookie is valid
 *              (default: domain of calling document)
 * [secure]   Boolean value indicating if the cookie transmission requires a
 *              secure transmission
 */
function setCookie(name, value, expires, path, domain, secure)
{
    document.cookie=name + "=" + escape(value) +
        ((expires) ? "; expires=" + expires.toGMTString() : "") +
        ((path) ? "; path=" + path : "; path=/") +
        ((domain) ? "; domain=" + domain : "") +
        ((secure) ? "; secure" : "");
}

function setRootCookie(name, value, expires, path, domain, secure)
{
    document.cookie= name + "=" + escape(value) +
        ((expires) ? "; expires=" + expires.toGMTString() : "") +
        "; path=/" +
        ((domain) ? "; domain=" + domain : "") +
        ((secure) ? "; secure" : "");
}

/**
 * Gets the value of the specified cookie.
 *
 * name  Name of the desired cookie.
 *
 * Returns a string containing value of specified cookie,
 *   or null if cookie does not exist.
 */
function getCookie(name)
{
    var dc = document.cookie;
    var prefix = name + "=";
    var begin = dc.indexOf("; " + prefix);
    if (begin == -1)
    {
        begin = dc.indexOf(prefix);
        if (begin !== 0)
        {
          return null;
        }
    }
    else
    {
        begin += 2;
    }
    var end = document.cookie.indexOf(";", begin);
    if (end == -1)
    {
        end = dc.length;
    }
    return unescape(dc.substring(begin + prefix.length, end));
}

/**
 * Deletes the specified cookie. Will only perform the deletion if
 *
 *   a) The cookie exists in the current path; or
 *   b) The alwaysDelete flag is specified
 *
 * name           name of the cookie
 * [path]         path of the cookie (must be same as path used to create cookie)
 * [domain]       domain of the cookie (must be same as domain used to create cookie)
 * [alwaysDelete] if true, delete the cookie whether it exists in the current path, or not
 */
function deleteCookie(name, path, domain, alwaysDelete)
{
    if (getCookie(name) || alwaysDelete)
    {
        document.cookie = name + "=" +
            ((path) ? "; path=" + path : "") +
            ((domain) ? "; domain=" + domain : "") +
            "; expires=" + new Date(1).toGMTString();
    }
}

// Copyright (c) 2013 Pieroxy <pieroxy@pieroxy.net>
// This work is free. You can redistribute it and/or modify it
// under the terms of the WTFPL, Version 2
// For more information see LICENSE.txt or http://www.wtfpl.net/
//
// For more information, the home page:
// http://pieroxy.net/blog/pages/lz-string/testing.html
//
// LZ-based compression algorithm, version 1.3.3
var LZString = {
  
  
  // private property
  _keyStr : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
  _f : String.fromCharCode,
  
  compressToBase64 : function (input) {
    if (input == null) return "";
    var output = "";
    var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
    var i = 0;
    
    input = LZString.compress(input);
    
    while (i < input.length*2) {
      
      if (i%2==0) {
        chr1 = input.charCodeAt(i/2) >> 8;
        chr2 = input.charCodeAt(i/2) & 255;
        if (i/2+1 < input.length) 
          chr3 = input.charCodeAt(i/2+1) >> 8;
        else 
          chr3 = NaN;
      } else {
        chr1 = input.charCodeAt((i-1)/2) & 255;
        if ((i+1)/2 < input.length) {
          chr2 = input.charCodeAt((i+1)/2) >> 8;
          chr3 = input.charCodeAt((i+1)/2) & 255;
        } else 
          chr2=chr3=NaN;
      }
      i+=3;
      
      enc1 = chr1 >> 2;
      enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
      enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
      enc4 = chr3 & 63;
      
      if (isNaN(chr2)) {
        enc3 = enc4 = 64;
      } else if (isNaN(chr3)) {
        enc4 = 64;
      }
      
      output = output +
        LZString._keyStr.charAt(enc1) + LZString._keyStr.charAt(enc2) +
          LZString._keyStr.charAt(enc3) + LZString._keyStr.charAt(enc4);
      
    }
    
    return output;
  },
  
  decompressFromBase64 : function (input) {
    if (input == null) return "";
    var output = "",
        ol = 0, 
        output_,
        chr1, chr2, chr3,
        enc1, enc2, enc3, enc4,
        i = 0, f=LZString._f;
    
    input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
    
    while (i < input.length) {
      
      enc1 = LZString._keyStr.indexOf(input.charAt(i++));
      enc2 = LZString._keyStr.indexOf(input.charAt(i++));
      enc3 = LZString._keyStr.indexOf(input.charAt(i++));
      enc4 = LZString._keyStr.indexOf(input.charAt(i++));
      
      chr1 = (enc1 << 2) | (enc2 >> 4);
      chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      chr3 = ((enc3 & 3) << 6) | enc4;
      
      if (ol%2==0) {
        output_ = chr1 << 8;
        
        if (enc3 != 64) {
          output += f(output_ | chr2);
        }
        if (enc4 != 64) {
          output_ = chr3 << 8;
        }
      } else {
        output = output + f(output_ | chr1);
        
        if (enc3 != 64) {
          output_ = chr2 << 8;
        }
        if (enc4 != 64) {
          output += f(output_ | chr3);
        }
      }
      ol+=3;
    }
    
    return LZString.decompress(output);
    
  },

  compressToUTF16 : function (input) {
    if (input == null) return "";
    var output = "",
        i,c,
        current,
        status = 0,
        f = LZString._f;
    
    input = LZString.compress(input);
    
    for (i=0 ; i<input.length ; i++) {
      c = input.charCodeAt(i);
      switch (status++) {
        case 0:
          output += f((c >> 1)+32);
          current = (c & 1) << 14;
          break;
        case 1:
          output += f((current + (c >> 2))+32);
          current = (c & 3) << 13;
          break;
        case 2:
          output += f((current + (c >> 3))+32);
          current = (c & 7) << 12;
          break;
        case 3:
          output += f((current + (c >> 4))+32);
          current = (c & 15) << 11;
          break;
        case 4:
          output += f((current + (c >> 5))+32);
          current = (c & 31) << 10;
          break;
        case 5:
          output += f((current + (c >> 6))+32);
          current = (c & 63) << 9;
          break;
        case 6:
          output += f((current + (c >> 7))+32);
          current = (c & 127) << 8;
          break;
        case 7:
          output += f((current + (c >> 8))+32);
          current = (c & 255) << 7;
          break;
        case 8:
          output += f((current + (c >> 9))+32);
          current = (c & 511) << 6;
          break;
        case 9:
          output += f((current + (c >> 10))+32);
          current = (c & 1023) << 5;
          break;
        case 10:
          output += f((current + (c >> 11))+32);
          current = (c & 2047) << 4;
          break;
        case 11:
          output += f((current + (c >> 12))+32);
          current = (c & 4095) << 3;
          break;
        case 12:
          output += f((current + (c >> 13))+32);
          current = (c & 8191) << 2;
          break;
        case 13:
          output += f((current + (c >> 14))+32);
          current = (c & 16383) << 1;
          break;
        case 14:
          output += f((current + (c >> 15))+32, (c & 32767)+32);
          status = 0;
          break;
      }
    }
    
    return output + f(current + 32);
  },
  

  decompressFromUTF16 : function (input) {
    if (input == null) return "";
    var output = "",
        current,c,
        status=0,
        i = 0,
        f = LZString._f;
    
    while (i < input.length) {
      c = input.charCodeAt(i) - 32;
      
      switch (status++) {
        case 0:
          current = c << 1;
          break;
        case 1:
          output += f(current | (c >> 14));
          current = (c&16383) << 2;
          break;
        case 2:
          output += f(current | (c >> 13));
          current = (c&8191) << 3;
          break;
        case 3:
          output += f(current | (c >> 12));
          current = (c&4095) << 4;
          break;
        case 4:
          output += f(current | (c >> 11));
          current = (c&2047) << 5;
          break;
        case 5:
          output += f(current | (c >> 10));
          current = (c&1023) << 6;
          break;
        case 6:
          output += f(current | (c >> 9));
          current = (c&511) << 7;
          break;
        case 7:
          output += f(current | (c >> 8));
          current = (c&255) << 8;
          break;
        case 8:
          output += f(current | (c >> 7));
          current = (c&127) << 9;
          break;
        case 9:
          output += f(current | (c >> 6));
          current = (c&63) << 10;
          break;
        case 10:
          output += f(current | (c >> 5));
          current = (c&31) << 11;
          break;
        case 11:
          output += f(current | (c >> 4));
          current = (c&15) << 12;
          break;
        case 12:
          output += f(current | (c >> 3));
          current = (c&7) << 13;
          break;
        case 13:
          output += f(current | (c >> 2));
          current = (c&3) << 14;
          break;
        case 14:
          output += f(current | (c >> 1));
          current = (c&1) << 15;
          break;
        case 15:
          output += f(current | c);
          status=0;
          break;
      }
      
      
      i++;
    }
    
    return LZString.decompress(output);
    //return output;
    
  },


  
  compress: function (uncompressed) {
    if (uncompressed == null) return "";
    var i, value,
        context_dictionary= {},
        context_dictionaryToCreate= {},
        context_c="",
        context_wc="",
        context_w="",
        context_enlargeIn= 2, // Compensate for the first entry which should not count
        context_dictSize= 3,
        context_numBits= 2,
        context_data_string="", 
        context_data_val=0, 
        context_data_position=0,
        ii,
        f=LZString._f;
    
    for (ii = 0; ii < uncompressed.length; ii += 1) {
      context_c = uncompressed.charAt(ii);
      if (!Object.prototype.hasOwnProperty.call(context_dictionary,context_c)) {
        context_dictionary[context_c] = context_dictSize++;
        context_dictionaryToCreate[context_c] = true;
      }
      
      context_wc = context_w + context_c;
      if (Object.prototype.hasOwnProperty.call(context_dictionary,context_wc)) {
        context_w = context_wc;
      } else {
        if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate,context_w)) {
          if (context_w.charCodeAt(0)<256) {
            for (i=0 ; i<context_numBits ; i++) {
              context_data_val = (context_data_val << 1);
              if (context_data_position == 15) {
                context_data_position = 0;
                context_data_string += f(context_data_val);
                context_data_val = 0;
              } else {
                context_data_position++;
              }
            }
            value = context_w.charCodeAt(0);
            for (i=0 ; i<8 ; i++) {
              context_data_val = (context_data_val << 1) | (value&1);
              if (context_data_position == 15) {
                context_data_position = 0;
                context_data_string += f(context_data_val);
                context_data_val = 0;
              } else {
                context_data_position++;
              }
              value = value >> 1;
            }
          } else {
            value = 1;
            for (i=0 ; i<context_numBits ; i++) {
              context_data_val = (context_data_val << 1) | value;
              if (context_data_position == 15) {
                context_data_position = 0;
                context_data_string += f(context_data_val);
                context_data_val = 0;
              } else {
                context_data_position++;
              }
              value = 0;
            }
            value = context_w.charCodeAt(0);
            for (i=0 ; i<16 ; i++) {
              context_data_val = (context_data_val << 1) | (value&1);
              if (context_data_position == 15) {
                context_data_position = 0;
                context_data_string += f(context_data_val);
                context_data_val = 0;
              } else {
                context_data_position++;
              }
              value = value >> 1;
            }
          }
          context_enlargeIn--;
          if (context_enlargeIn == 0) {
            context_enlargeIn = Math.pow(2, context_numBits);
            context_numBits++;
          }
          delete context_dictionaryToCreate[context_w];
        } else {
          value = context_dictionary[context_w];
          for (i=0 ; i<context_numBits ; i++) {
            context_data_val = (context_data_val << 1) | (value&1);
            if (context_data_position == 15) {
              context_data_position = 0;
              context_data_string += f(context_data_val);
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = value >> 1;
          }
          
          
        }
        context_enlargeIn--;
        if (context_enlargeIn == 0) {
          context_enlargeIn = Math.pow(2, context_numBits);
          context_numBits++;
        }
        // Add wc to the dictionary.
        context_dictionary[context_wc] = context_dictSize++;
        context_w = String(context_c);
      }
    }
    
    // Output the code for w.
    if (context_w !== "") {
      if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate,context_w)) {
        if (context_w.charCodeAt(0)<256) {
          for (i=0 ; i<context_numBits ; i++) {
            context_data_val = (context_data_val << 1);
            if (context_data_position == 15) {
              context_data_position = 0;
              context_data_string += f(context_data_val);
              context_data_val = 0;
            } else {
              context_data_position++;
            }
          }
          value = context_w.charCodeAt(0);
          for (i=0 ; i<8 ; i++) {
            context_data_val = (context_data_val << 1) | (value&1);
            if (context_data_position == 15) {
              context_data_position = 0;
              context_data_string += f(context_data_val);
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = value >> 1;
          }
        } else {
          value = 1;
          for (i=0 ; i<context_numBits ; i++) {
            context_data_val = (context_data_val << 1) | value;
            if (context_data_position == 15) {
              context_data_position = 0;
              context_data_string += f(context_data_val);
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = 0;
          }
          value = context_w.charCodeAt(0);
          for (i=0 ; i<16 ; i++) {
            context_data_val = (context_data_val << 1) | (value&1);
            if (context_data_position == 15) {
              context_data_position = 0;
              context_data_string += f(context_data_val);
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = value >> 1;
          }
        }
        context_enlargeIn--;
        if (context_enlargeIn == 0) {
          context_enlargeIn = Math.pow(2, context_numBits);
          context_numBits++;
        }
        delete context_dictionaryToCreate[context_w];
      } else {
        value = context_dictionary[context_w];
        for (i=0 ; i<context_numBits ; i++) {
          context_data_val = (context_data_val << 1) | (value&1);
          if (context_data_position == 15) {
            context_data_position = 0;
            context_data_string += f(context_data_val);
            context_data_val = 0;
          } else {
            context_data_position++;
          }
          value = value >> 1;
        }
        
        
      }
      context_enlargeIn--;
      if (context_enlargeIn == 0) {
        context_enlargeIn = Math.pow(2, context_numBits);
        context_numBits++;
      }
    }
    
    // Mark the end of the stream
    value = 2;
    for (i=0 ; i<context_numBits ; i++) {
      context_data_val = (context_data_val << 1) | (value&1);
      if (context_data_position == 15) {
        context_data_position = 0;
        context_data_string += f(context_data_val);
        context_data_val = 0;
      } else {
        context_data_position++;
      }
      value = value >> 1;
    }
    
    // Flush the last char
    while (true) {
      context_data_val = (context_data_val << 1);
      if (context_data_position == 15) {
        context_data_string += f(context_data_val);
        break;
      }
      else context_data_position++;
    }
    return context_data_string;
  },
  
  decompress: function (compressed) {
    if (compressed == null) return "";
    if (compressed == "") return null;
    var dictionary = [],
        next,
        enlargeIn = 4,
        dictSize = 4,
        numBits = 3,
        entry = "",
        result = "",
        i,
        w,
        bits, resb, maxpower, power,
        c,
        f = LZString._f,
        data = {string:compressed, val:compressed.charCodeAt(0), position:32768, index:1};
    
    for (i = 0; i < 3; i += 1) {
      dictionary[i] = i;
    }
    
    bits = 0;
    maxpower = Math.pow(2,2);
    power=1;
    while (power!=maxpower) {
      resb = data.val & data.position;
      data.position >>= 1;
      if (data.position == 0) {
        data.position = 32768;
        data.val = data.string.charCodeAt(data.index++);
      }
      bits |= (resb>0 ? 1 : 0) * power;
      power <<= 1;
    }
    
    switch (next = bits) {
      case 0: 
          bits = 0;
          maxpower = Math.pow(2,8);
          power=1;
          while (power!=maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position == 0) {
              data.position = 32768;
              data.val = data.string.charCodeAt(data.index++);
            }
            bits |= (resb>0 ? 1 : 0) * power;
            power <<= 1;
          }
        c = f(bits);
        break;
      case 1: 
          bits = 0;
          maxpower = Math.pow(2,16);
          power=1;
          while (power!=maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position == 0) {
              data.position = 32768;
              data.val = data.string.charCodeAt(data.index++);
            }
            bits |= (resb>0 ? 1 : 0) * power;
            power <<= 1;
          }
        c = f(bits);
        break;
      case 2: 
        return "";
    }
    dictionary[3] = c;
    w = result = c;
    while (true) {
      if (data.index > data.string.length) {
        return "";
      }
      
      bits = 0;
      maxpower = Math.pow(2,numBits);
      power=1;
      while (power!=maxpower) {
        resb = data.val & data.position;
        data.position >>= 1;
        if (data.position == 0) {
          data.position = 32768;
          data.val = data.string.charCodeAt(data.index++);
        }
        bits |= (resb>0 ? 1 : 0) * power;
        power <<= 1;
      }

      switch (c = bits) {
        case 0: 
          bits = 0;
          maxpower = Math.pow(2,8);
          power=1;
          while (power!=maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position == 0) {
              data.position = 32768;
              data.val = data.string.charCodeAt(data.index++);
            }
            bits |= (resb>0 ? 1 : 0) * power;
            power <<= 1;
          }

          dictionary[dictSize++] = f(bits);
          c = dictSize-1;
          enlargeIn--;
          break;
        case 1: 
          bits = 0;
          maxpower = Math.pow(2,16);
          power=1;
          while (power!=maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position == 0) {
              data.position = 32768;
              data.val = data.string.charCodeAt(data.index++);
            }
            bits |= (resb>0 ? 1 : 0) * power;
            power <<= 1;
          }
          dictionary[dictSize++] = f(bits);
          c = dictSize-1;
          enlargeIn--;
          break;
        case 2: 
          return result;
      }
      
      if (enlargeIn == 0) {
        enlargeIn = Math.pow(2, numBits);
        numBits++;
      }
      
      if (dictionary[c]) {
        entry = dictionary[c];
      } else {
        if (c === dictSize) {
          entry = w + w.charAt(0);
        } else {
          return null;
        }
      }
      result += entry;
      
      // Add w+entry[0] to the dictionary.
      dictionary[dictSize++] = w + entry.charAt(0);
      enlargeIn--;
      
      w = entry;
      
      if (enlargeIn == 0) {
        enlargeIn = Math.pow(2, numBits);
        numBits++;
      }
      
    }
  }
};

if( typeof module !== 'undefined' && module != null ) {
  module.exports = LZString
}
var CLIENT_CACHE_GUID_COOKIE_NAME = 'web_client_cache_guid';

var ClientCache =
{
    LZ_STRING_COMPRESSED_KEY_PREFIX : 'lzsc_',
    DOM_QUOTA_REACHED_EXCEPTION : 22,

    clear : function()
    {
      sessionStorage.clear();
    },

    /**
     * Sets an item to the ClientCache. Uses compression if string representation of the data has 524288 characters or
     * more. Compression is also used if a quota exceeded exception is thrown while setting the data without using
     * compression.
     *
     * @param alwaysCompress store the item compressed
     */
    setItem : function( key, value, alwaysCompress )
    {
      this._validateSession();
      var isCompressedMode = false;
      try
      {
        // sessionStorage.setItem stringify non-string variables anyways. We will do it here to figure out its length
        // below.
        if ( typeof ( value ) !== 'string' )
        {
          value = value.toString();
        }
        // store compressed if larger than .5MB or if the caller explicitly asks for compression
        if ( value.length >= 524288 || alwaysCompress )
        {
          isCompressedMode = true;
          sessionStorage.removeItem( key );
          this._setItemLzStrCompressed( key, value, true );
        }
        else
        {
          sessionStorage.removeItem( this.LZ_STRING_COMPRESSED_KEY_PREFIX + key );
          sessionStorage.setItem( key, value );
        }
      }
      catch ( e )
      {
        if ( !isCompressedMode && this.DOM_QUOTA_REACHED_EXCEPTION === this.getClientCacheException( e ) )
        {
          sessionStorage.removeItem( key );
          this._setItemLzStrCompressed( key, value, true );
        }
        else
        {
          throw e;
        }
      }
    },

    /**
     * @private For internal use only. Please use this.setItem(...) instead. Sets lz-string compressed item to the
     *          ClientCache.
     */
    _setItemLzStrCompressed : function( key, value, skipSessionValidation )
    {
      if ( !skipSessionValidation )
      {
        this._validateSession();
      }
      sessionStorage.setItem( this.LZ_STRING_COMPRESSED_KEY_PREFIX + key, LZString.compressToUTF16( value ) );
    },

    /**
     * @param onlyLookupCompressed gets the item stored compressed and skips altogether checking for non-compressed item
     *          with the key
     */
    getItem : function( key, onlyLookupCompressed )
    {
      this._validateSession();
      var item;
      if ( !onlyLookupCompressed )
      {
        item = sessionStorage.getItem( key );
      }
      if ( !item /* undefined or null */|| onlyLookupCompressed )
      {
        item = this._getItemLzStrCompressed( key, true );
      }
      return item;
    },

    /**
     * @private For internal use only. Please use this.getItem(...) instead. Gets lz-string compressed item from the
     *          ClientCache.
     */
    _getItemLzStrCompressed : function( key, skipSessionValidation )
    {
      if ( !skipSessionValidation )
      {
        this._validateSession();
      }
      var itemTmp = sessionStorage.getItem( this.LZ_STRING_COMPRESSED_KEY_PREFIX + key );
      if ( itemTmp )
      {
        return LZString.decompressFromUTF16( itemTmp );
      }
      return itemTmp;
    },

    removeItem : function( key )
    {
      this._validateSession();
      sessionStorage.removeItem( key );
      sessionStorage.removeItem( this.LZ_STRING_COMPRESSED_KEY_PREFIX + key );
    },

    /**
     * The guidCookie is used for web client cache (HTML5 sessionStorage) invalidation and needs to go with Learn session
     * life cycle. There is a copy for the cookie value inside sessionStorage. The cookie will be deleted at the end of
     * the session, and a new cookie will be generated at the start of a new session. All the methods in client_cache.js will
     * check this cookie value with the one stored in sessionStorage, if not same, flush sessionStorage data. This can
     * help prevent sessionStorage data from leaking to other sessions who use the same browser. The cookie will be read
     * in js, so it has to be not httpOnly.
     */
    _validateSession : function()
    {
      var guidCookie = getCookie( CLIENT_CACHE_GUID_COOKIE_NAME );
      if ( guidCookie == null || guidCookie != sessionStorage.getItem( CLIENT_CACHE_GUID_COOKIE_NAME ) )
      {
        sessionStorage.clear();
        if ( guidCookie != null )
        {
          sessionStorage.setItem( CLIENT_CACHE_GUID_COOKIE_NAME, guidCookie );
        }
        else
        {
          var genratedGUID = this.getGUID();
          setCookie(CLIENT_CACHE_GUID_COOKIE_NAME, genratedGUID);
          sessionStorage.setItem( CLIENT_CACHE_GUID_COOKIE_NAME, genratedGUID );
        }
      }
    },

    getClientCacheException : function( exception )
    {
      if ( !exception )
      {
        return;
      }
      if ( exception.name &&
           ( exception.name === "NS_ERROR_DOM_QUOTA_REACHED" /* FF */|| exception.name === "QUOTA_EXCEEDED_ERR" /* Safari */|| exception.name === "QuotaExceededError" /* Chrome */) )
      {
        // LRN-84254 this is a solution at least to give a more graceful error message from each consumer of the
        // ClientCache mechanism (ex. Grace Center). We may eventually have to come up with a different solution that
        // doen't get limited by the sessionStorage limit imposed by the browsers.
        return this.DOM_QUOTA_REACHED_EXCEPTION;
      };
      return;
    },

    getGUID : function()
    {
      function randomBytesString( num ) {
          return ( Math.random().toString( 16 ) + repeatString( "00", num + 1 ) ).substr( 2, num * 2 );
      }

      function repeatString( str, num ) {
          if ( num <= 0 )
          {
              return "";
          }
          return str + repeatString( str, num - 1 );
      }

      var version =  "4" + randomBytesString( 2 ).substr( 1 );

      var variant = randomBytesString( 2 );
      variant = ( variant.charAt( 0 ) & 0x3 | 0x8 ).toString( 16 ) + variant.substr( 1 );

      return randomBytesString( 4 ) + "-" + randomBytesString( 2 ) + "-" + version + "-" + variant + "-" + randomBytesString( 6 );
    }

};/**
 * globalNavigation.js, resize the navigation div and content div
 **/

var globalNavigation = {};

globalNavigation.init = function()
{
  var quickLinks = $('quick_links_wrap');
  
  if ( self != window.parent || !page.util.parentWindowIsUltraApp )
  {
    // If we have a parent then we're not in the top of the page - while we shouldn't get here in the first
    // place due to proper application logic not showing the globalnav to begin with, if we DO then this is
    // a fallback to remove it from the page.  Currently this logic should only be kicking in when you
    // add 'portfolio homepage' to your course content area and then click through to it and then navigate into
    // various pieces of the portfolio tool - nested pages may not retain the globalNavigation=false
    // parameter and this code handles that case.
    var navArea = $( 'globalNavPageNavArea' );
    if ( navArea )
    {
      var navBarWrap = navArea.up().down( '.global-nav-bar-wrap' );
      if ( navBarWrap )
      {
        navBarWrap.hide();
      }
      navArea.hide();
      if ( quickLinks )
      {
        quickLinks.hide();
      }
      return;
    }
  }

  if (page.util.parentWindowIsUltraApp())
  {
    quickLinks.hide();
  }
  
  // to set contentDiv height
  globalNavigation.onResize();  

  var navDivHeight = globalNavigation.getNavDivHeight();
  if ( quickLinks  && navDivHeight !== 0 )
  {
    quickLinks.setStyle({ top: (navDivHeight - quickLinks.getHeight()) + 'px'});
  }
};

globalNavigation.getNavDivHeight = function()
{
  return $('globalNavPageNavArea') ? $('globalNavPageNavArea').getHeight() : 0;
};

globalNavigation.setNavDivHeight = function(height)
{
  if (window.self === window.top) {
    $('globalNavPageNavArea').setStyle({height: height + 'px'});
    globalNavigation.onResize();
  }
};

globalNavigation.onResize = function(ev)
{
  var windowHeight = document.viewport.getHeight();
  var navDivHeight = $('globalNavPageNavArea').getHeight();
  var contentDiv = $('globalNavPageContentArea');
  contentDiv.hide();

  if (window.matchMedia("(max-width: 1037px)").matches) {
    if (window.self === window.top) { 
      contentDiv.setStyle({height: (windowHeight - navDivHeight) + 'px'});
    }
  } else {
    contentDiv.setStyle({height: (windowHeight - navDivHeight) + 'px', overflow: 'visible'});
  }

  contentDiv.show();
};

globalNavigation.getContentAreaScrollOffset = function()
{
  var contentDiv = $( 'globalNavPageContentArea' );
  if ( contentDiv )
  {
    var res =
    {
        scrollLeft : contentDiv.scrollLeft,
        scrollTop : contentDiv.scrollTop
    };
    return res;
  }
  else
  {
    var res =
    {
        scrollLeft : 0,
        scrollTop : 0
    };
    return res;
  }
};

globalNavigation.openHelpWindow = function(helpUrl)
{
  var features='width=900, height=675, toolbar=yes, location=yes, menubar=yes, scrollbars=yes, status=yes, resizable=yes';
  newWindow=window.open(helpUrl,'_blank',features);
  if(newWindow != null){
    newWindow.focus();
  }
  return false;
};

globalNavigation.getNoGlobalNavUrl = function(url)
{
  return url + (url.split('?')[1] ? '&':'?') + 'globalNavigation=false';
};

globalNavigation.redirectTopWindow = function()
{
  if(window != top && !page.util.insideUltra() )
  {
    top.location.href = window.location.href.replace('globalNavigation=false', 'globalNavigation=true');
  }
};

globalNavigation.openFullPageFromIframe = function(baseWindow, url)
{
  var par = baseWindow || window;
  var tmp = par.parent;
  while (tmp && tmp != par)
  {
    par = tmp;
    tmp = par.parent;
  }

  if ( baseWindow && baseWindow.page.util.insideUltra() )
  {
    //Ultra is enabled in the opener window.
    var classicCourseIframe = par.document.getElementsByClassName("classic-learn-iframe")[0];
    if ( classicCourseIframe )
    {
      if ( url.startsWith('/') )
      {
        url = document.location.origin + url;
      }
      classicCourseIframe.src = url;
    }
    //TODO: the case of the classic learn iframe not exiting need be handled, i.e. if you navigate away from the course in Ultra but leave the separate window open and then click,
    //the course need be opened then. 
  }
  else
  {
    par.document.location = url;
  }
};var $namespace=function(d,g,b){var f=d.split(g||"."),h=b||window,e,a;for(e=0,a=f.length;e<a;e++){h=h[f[e]]=h[f[e]]||{}}return h};var $type=function(a,b){if(!a instanceof b){throw new SyntaxError()}};if(!$){var $=function(a){return document.getElementById(a)}}if(!Array.prototype.each){Array.prototype.each=function(a){if(typeof a!="function"){throw"Illegal Argument for Array.each"}for(var b=0;b<this.length;b++){a(this[b])}}}if(!Array.prototype.contains){Array.prototype.contains=function(b){var a=false;this.each(function(d){if((b.equals&&b.equals(d))||d==b){a=true;return}});return a}}if(!Array.prototype.containsKey){Array.prototype.containsKey=function(b){for(var a in this){if(a.toLowerCase()==b.toLowerCase()){return true}}return false}}if(!Array.prototype.getCaseInsensitive){Array.prototype.getCaseInsensitive=function(b){for(var a in this){if(a.toLowerCase()==b.toLowerCase()){return this[a]}}return null}}if(!String.prototype.charCodeAt){String.prototype.charCodeAt=function(a){var e=this.charAt(a);for(var b=0;b<65536;b++){var d=String.fromCharCode(b);if(d==e){return b}}return 0}}if(!String.prototype.endsWith){String.prototype.endsWith=function(a){return this.substr((this.length-a.length),a.length)==a}}if(!Exception){var Exception=function(a,b){this.cause=b;this.errorMessage=a};Exception.prototype=Error.prototype;Exception.prototype.getCause=function(){return this.cause};Exception.prototype.getMessage=function(){return this.message};Exception.prototype.getStackTrace=function(){if(this.callstack){return this.callstack}if(this.stack){var b=stack.split("\n");for(var d=0,a=b.length;d<a;d++){if(b[d].match(/^\s*[A-Za-z0-9\=+\$]+\(/)){this.callstack.push(b[d])}}this.callstack.shift();return this.callstack}else{if(window.opera&&this.message){var b=this.message.split("\n");for(var d=0,a=b.length;d<a;d++){if(b[d].match(/^\s*[A-Za-z0-9\=+\$]+\(/)){var f=b[d];if(b[d+1]){f+=" at "+b[d+1];d++}this.callstack.push(f)}}this.callstack.shift();return this.callstack}else{var g=arguments.callee.caller;while(g){var e=g.toString();var h=e.substring(e.indexOf("function")+8,e.indexOf("("))||"anonymous";this.callstack.push(h);g=g.caller}return this.callstack}}};Exception.prototype.printStackTrace=function(b){var a=this.getMessage()+"|||"+this.getStackTrace().join("|||");if(this.cause){if(this.cause.printStackTrace){a+="||||||Caused by "+this.cause.printStackTrace().replace("\n","|||")}}if(!b){return b.replace("|||","\n")}else{if(b.value){b.value=a.replace("|||","\n")}else{if(b.writeln){b.writeln(a.replace("|||","\n"))}else{if(b.innerHTML){b.innerHTML=a.replace("|||","<br/>")}else{if(b.innerText){b.innerText=a.replace("|||","<br/>")}else{if(b.append){b.append(a.replace("|||","\n"))}else{if(b instanceof Function){b(a.replace("|||","\n"))}}}}}}}}}if(!RuntimeException){var RuntimeException=Exception}if(!IllegalArgumentException){var IllegalArgumentException=Exception}if(!DateFormat){var DateFormat=function(d){var b=d;var a={longMonths:["January","February","March","April","May","June","July","August","September","October","November","December"],shortMonths:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],longDays:["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],shortDays:["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],d:function(e){return(e.getDate()<10?"0":"")+e.getDate()},D:function(e){return a.shortDays[e.getDay()]},j:function(e){return e.getDate()},l:function(e){return a.longDays[e.getDay()]},N:function(e){return e.getDay()+1},S:function(e){return(e.getDate()%10==1&&e.getDate()!=11?"st":(e.getDate()%10==2&&e.getDate()!=12?"nd":(e.getDate()%10==3&&e.getDate()!=13?"rd":"th")))},w:function(e){return e.getDay()},z:function(e){return"Not Yet Supported"},W:function(e){return"Not Yet Supported"},F:function(e){return a.longMonths[e.getMonth()]},m:function(e){return(e.getMonth()<9?"0":"")+(e.getMonth()+1)},M:function(e){return a.shortMonths[e.getMonth()]},n:function(e){return e.getMonth()+1},t:function(e){return"Not Yet Supported"},L:function(e){return(((e.getFullYear()%4==0)&&(e.getFullYear()%100!=0))||(e.getFullYear()%400==0))?"1":"0"},o:function(e){return"Not Supported"},Y:function(e){return e.getFullYear()},y:function(e){return(""+e.getFullYear()).substr(2)},a:function(e){return e.getHours()<12?"am":"pm"},A:function(e){return e.getHours()<12?"AM":"PM"},B:function(e){return"Not Yet Supported"},g:function(e){return e.getHours()%12||12},G:function(e){return e.getHours()},h:function(e){return((e.getHours()%12||12)<10?"0":"")+(e.getHours()%12||12)},H:function(e){return(e.getHours()<10?"0":"")+e.getHours()},i:function(e){return(e.getMinutes()<10?"0":"")+e.getMinutes()},s:function(e){return(e.getSeconds()<10?"0":"")+e.getSeconds()},e:function(e){return"Not Yet Supported"},I:function(e){return"Not Supported"},O:function(e){return(-e.getTimezoneOffset()<0?"-":"+")+(Math.abs(e.getTimezoneOffset()/60)<10?"0":"")+(Math.abs(e.getTimezoneOffset()/60))+"00"},P:function(e){return(-e.getTimezoneOffset()<0?"-":"+")+(Math.abs(e.getTimezoneOffset()/60)<10?"0":"")+(Math.abs(e.getTimezoneOffset()/60))+":"+(Math.abs(e.getTimezoneOffset()%60)<10?"0":"")+(Math.abs(e.getTimezoneOffset()%60))
},T:function(g){var f=g.getMonth();g.setMonth(0);var e=g.toTimeString().replace(/^.+ \(?([^\)]+)\)?$/,"$1");g.setMonth(f);return e},Z:function(e){return -e.getTimezoneOffset()*60},c:function(e){return e.format("Y-m-d")+"T"+e.format("H:i:sP")},r:function(e){return e.toString()},U:function(e){return e.getTime()/1000}};return{format:function(g){var e="";for(var f=0;f<b.length;f++){var h=b.charAt(f);if(a[h]){e+=a[h].call(g)}else{e+=h}}return e}}};DateFormat.getDateInstance=function(){return new DateFormat("M/d/y h:i a")}}$namespace("org.owasp.esapi");org.owasp.esapi.ESAPI=function(g){var b=g;if(!b){throw new RuntimeException("Configuration Error - Unable to load $ESAPI_Properties Object")}var a=null;var e=null;var d=null;var f=null;var h=null;return{properties:b,encoder:function(){if(!a){if(!b.encoder.Implementation){throw new RuntimeException("Configuration Error - $ESAPI.properties.encoder.Implementation object not found.")}a=new b.encoder.Implementation()}return a},logFactory:function(){if(!d){if(!b.logging.Implementation){throw new RuntimeException("Configuration Error - $ESAPI.properties.logging.Implementation object not found.")}d=new b.logging.Implementation()}return d},logger:function(i){return this.logFactory().getLogger(i)},locale:function(){return org.owasp.esapi.i18n.Locale.getLocale(b.localization.DefaultLocale)},resourceBundle:function(){if(!f){if(!b.localization.StandardResourceBundle){throw new RuntimeException("Configuration Error - $ESAPI.properties.localization.StandardResourceBundle not found.")}f=new org.owasp.esapi.i18n.ObjectResourceBundle(b.localization.StandardResourceBundle)}return f},validator:function(){if(!e){if(!b.validation.Implementation){throw new RuntimeException("Configuration Error - $ESAPI.properties.validation.Implementation object not found.")}e=new b.validation.Implementation()}return e},httpUtilities:function(){if(!h){h=new org.owasp.esapi.HTTPUtilities()}return h}}};var $ESAPI=null;org.owasp.esapi.ESAPI.initialize=function(){$ESAPI=new org.owasp.esapi.ESAPI(Base.esapi.properties)};$namespace("org.owasp.esapi");org.owasp.esapi.Encoder=function(){};$namespace("org.owasp.esapi");org.owasp.esapi.EncoderConstants={CHAR_LOWERS:["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z"],CHAR_UPPERS:["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"],CHAR_DIGITS:["0","1","2","3","4","5","6","7","8","9"],CHAR_SPECIALS:["!","$","*","+","-",".","=","?","@","^","_","|","~"],CHAR_LETTERS:["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z","A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"],CHAR_ALNUM:["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z","A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z","0","1","2","3","4","5","6","7","8","9"]};$namespace("org.owasp.esapi");org.owasp.esapi.EnterpriseSecurityException=function(b,a,e){var f=a;var d=new Exception(b,e);return{getMessage:d.getMessage,getUserMessage:d.getMessage,getLogMessage:function(){return f},getStackTrace:d.getStackTrace,printStackTrace:d.printStackTrace}};$namespace("org.owasp.esapi");org.owasp.esapi.HTTPUtilities=function(){var b=$ESAPI.logger("HTTPUtilities");var d=$ESAPI.resourceBundle();var a=org.owasp.esapi.Logger.EventType;return{addCookie:function(h){$type(h,org.owasp.esapi.net.Cookie);if(window.top.location.protocol!="http:"||window.top.location.protocol!="https:"){throw new RuntimeException(d.getString("HTTPUtilities.Cookie.Protocol",{protocol:window.top.location.protocol}))}var f=h.getName(),m=h.getValue(),k=h.getMaxAge(),i=h.getDomain(),p=h.getPath(),e=h.getSecure();var n=new org.owasp.esapi.ValidationErrorList();var l=$ESAPI.validator().getValidInput("cookie name",f,"HttpCookieName",50,false,n);var g=$ESAPI.validator().getValidInput("cookie value",m,"HttpCookieValue",5000,false,n);if(n.size()==0){var j=f+"="+escape(m);j+=k?";expires="+(new Date((new Date()).getTime()+(1000*k)).toGMTString()):"";j+=p?";path="+p:"";j+=i?";domain="+i:"";j+=e||$ESAPI.properties.httputilities.cookies.ForceSecure?";secure":"";document.cookie=j}else{b.warning(a.SECURITY_FAILURE,d.getString("HTTPUtilities.Cookie.UnsafeData",{name:f,value:m}))}},getCookie:function(j){var f=document.cookie.split("; ");for(var h=0,e=f.length;h<e;h++){var g=f[h].split("=");if(g[0]==escape(j)){return new org.owasp.esapi.net.Cookie(j,g[1]?unescape(g[1]):"")}}return null},killAllCookies:function(){var f=document.cookie.split("; ");for(var j=0,e=f.length;j<e;j++){var h=f[j].split("=");var g=unescape(h[0]);if(!this.killCookie(g)){throw new RuntimeException(d.getString("HTTPUtilities.Cookie.CantKill",{name:g}))}}},killCookie:function(e){var f=this.getCookie(e);if(f){f.setMaxAge(-10);this.addCookie(f);if(this.getCookie(e)){throw new RuntimeException(d.getString("HTTPUtilities.Cookie.CantKill",{name:e}))
}return true}return false},getRequestParameter:function(f){var e=window.top.location.search.substring(1);var g=e.indexOf(f);if(g<0){return null}g=g+f.length;var h=e.indexOf("&",g);if(h<0){h=e.length}return unescape(e.substring(g,h))}}};$namespace("org.owasp.esapi");org.owasp.esapi.IntrusionException=function(d,b,a){var e=new org.owasp.esapi.EnterpriseSecurityException(d,b,a);return{getMessage:e.getMessage,getUserMessage:e.getMessage,getLogMessage:e.getLogMessage,getStackTrace:e.getStackTrace,printStackTrace:e.printStackTrace}};$namespace("org.owasp.esapi");org.owasp.esapi.LogFactory=function(){return{getLogger:false}};$namespace("org.owasp.esapi");org.owasp.esapi.Logger=function(){return{setLevel:false,fatal:false,error:false,isErrorEnabled:false,warning:false,isWarningEnabled:false,info:false,isInfoEnabled:false,debug:false,isDebugEnabled:false,trace:false,isTraceEnabled:false}};org.owasp.esapi.Logger.EventType=function(d,b){var a=d;var e=b;return{isSuccess:function(){return e},toString:function(){return a}}};with(org.owasp.esapi.Logger){EventType.SECURITY_SUCCESS=new EventType("SECURITY SUCCESS",true);EventType.SECURITY_FAILURE=new EventType("SECURITY FAILURE",false);EventType.EVENT_SUCCESS=new EventType("EVENT SUCCESS",true);EventType.EVENT_FAILURE=new EventType("EVENT FAILURE",false);OFF=Number.MAX_VALUE;FATAL=1000;ERROR=800;WARNING=600;INFO=400;DEBUG=200;TRACE=100;ALL=Number.MIN_VALUE}$namespace("org.owasp.esapi");org.owasp.esapi.PreparedString=function(d,a,g){var f=[];var e=[];function b(k){var h=0,l=0;for(var j=0;j<k.length;j++){if(k.charAt(j)==g){l++;f.push(k.substr(h,j));h=j+1}}f.push(k.substr(h));e=new Array(l)}if(!g){g="?"}b(d);return{set:function(h,j,i){if(h<1||h>e.length){throw new IllegalArgumentException("Attempt to set parameter: "+h+" on a PreparedString with only "+e.length+" placeholders")}if(!i){i=a}e[h-1]=i.encode([],j)},toString:function(){for(var h=0;h<e.length;h++){if(e[h]==null){throw new RuntimeException("Attempt to render PreparedString without setting parameter "+(h+1))}}var j="",k=0;for(var l=0;l<f.length;l++){j+=f[l];if(k<e.length){j+=e[k++]}}return j}}};$namespace("org.owasp.esapi");org.owasp.esapi.ValidationErrorList=function(){var a=Array();return{addError:function(b,d){if(b==null){throw new RuntimeException("Context cannot be null: "+d.getLogMessage(),d)}if(d==null){throw new RuntimeException("Context ("+b+") - Error cannot be null")}if(a[b]){throw new RuntimeException("Context ("+b+") already exists. must be unique.")}a[b]=d},errors:function(){return a},isEmpty:function(){return a.length==0},size:function(){return a.length}}};$namespace("org.owasp.esapi");org.owasp.esapi.ValidationRule=function(){return{getValid:false,setAllowNull:false,getTypeName:false,setTypeName:false,setEncoder:false,assertValid:false,getSafe:false,isValid:false,whitelist:false}};$namespace("org.owasp.esapi");org.owasp.esapi.Validator=function(){return{addRule:false,getRule:false,getValidInput:false,isValidDate:false,getValidDate:false,isValidSafeHTML:false,getValidSafeHTML:false,isValidCreditCard:false,getValidCreditCard:false,isValidFilename:false,getValidFilename:false,isValidNumber:false,getValidNumber:false,isValidPrintable:false,getValidPrintable:false}};$namespace("org.owasp.esapi.codecs.Base64");org.owasp.esapi.codecs.Base64={_keyStr:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",encode:function(h){if(!h){return null}var e="";var d,b,a,m,l,k,j;var f=0;var g=org.owasp.esapi.codecs.UTF8.encode(h);while(f<g.length){d=g.charCodeAt(f++);b=g.charCodeAt(f++);a=g.charCodeAt(f++);m=d>>2;l=((d&3)<<4)|(b>>4);k=((b&15)<<2)|(a>>6);j=a&63;if(isNaN(b)){k=j=64}else{if(isNaN(a)){j=64}}e+=this._keyStr.charAt(m)+this._keyStr.charAt(l)+this._keyStr.charAt(k)+this._keyStr.charAt(j)}return e},decode:function(h){if(!h){return null}var e="";var d,b,a,m,l,k,j;var f=0;var g=h.replace(/[^A-Za-z0-9\+\/\=]/g,"");while(f<g.length){m=this._keyStr.indexOf(g.charAt(f++));l=this._keyStr.indexOf(g.charAt(f++));k=this._keyStr.indexOf(g.charAt(f++));j=this._keyStr.indexOf(g.charAt(f++));d=(m<<2)|(l>>4);b=((l&15)<<4)|(k>>2);a=((k&3)<<6)|j;e+=String.fromCharCode(d);if(k!=64){e+=String.fromCharCode(b)}if(j!=64){e+=String.fromCharCode(a)}}e=org.owasp.esapi.codecs.UTF8.decode(e);return e}};$namespace("org.owasp.esapi.codecs");org.owasp.esapi.codecs.CSSCodec=function(){var a=new org.owasp.esapi.codecs.Codec();return{encode:a.encode,decode:a.decode,encodeCharacter:function(b,e){if(b.contains(e)){return e}var d=org.owasp.esapi.codecs.Codec.getHexForNonAlphanumeric(e);if(d==null){return e}return"\\"+d+" "},decodeCharacter:function(l){l.mark();var h=l.next();if(h==null){l.reset();return null}if(h!="\\"){l.reset();return null}var d=l.next();if(d==null){l.reset();return null}if(l.isHexDigit(d)){var b=d;for(var f=0;f<6;f++){var k=l.next();if(k==null||k.charCodeAt(0)==32){break}if(l.isHexDigit(k)){b+=k}else{input.pushback(k);break}}try{var j=parseInt(b,16);return String.fromCharCode(j)}catch(g){l.reset();return null}}return d
}}};$namespace("org.owasp.esapi.codecs");org.owasp.esapi.codecs.Codec=function(){return{encode:function(d,e){var a="";for(var b=0;b<e.length;b++){var f=e.charAt(b);a+=this.encodeCharacter(d,f)}return a},encodeCharacter:function(a,b){return b},decode:function(b){var a="";var d=new org.owasp.esapi.codecs.PushbackString(b);while(d.hasNext()){var e=this.decodeCharacter(d);if(e!=null){a+=e}else{a+=d.next()}}return a},decodeCharacter:function(a){return a.next()}}};org.owasp.esapi.codecs.Codec.getHexForNonAlphanumeric=function(a){if(a.charCodeAt(0)<256){return org.owasp.esapi.codecs.Codec.hex[a.charCodeAt(0)]}return a.charCodeAt(0).toString(16)};org.owasp.esapi.codecs.Codec.hex=[];for(var c=0;c<255;c++){if(c>=48&&c<=57||c>=65&&c<=90||c>=97&&c<=122){org.owasp.esapi.codecs.Codec.hex[c]=null}else{org.owasp.esapi.codecs.Codec.hex[c]=c.toString(16)}}var entityToCharacterMap=[];entityToCharacterMap["&quot"]="34";entityToCharacterMap["&amp"]="38";entityToCharacterMap["&lt"]="60";entityToCharacterMap["&gt"]="62";entityToCharacterMap["&nbsp"]="160";entityToCharacterMap["&iexcl"]="161";entityToCharacterMap["&cent"]="162";entityToCharacterMap["&pound"]="163";entityToCharacterMap["&curren"]="164";entityToCharacterMap["&yen"]="165";entityToCharacterMap["&brvbar"]="166";entityToCharacterMap["&sect"]="167";entityToCharacterMap["&uml"]="168";entityToCharacterMap["&copy"]="169";entityToCharacterMap["&ordf"]="170";entityToCharacterMap["&laquo"]="171";entityToCharacterMap["&not"]="172";entityToCharacterMap["&shy"]="173";entityToCharacterMap["&reg"]="174";entityToCharacterMap["&macr"]="175";entityToCharacterMap["&deg"]="176";entityToCharacterMap["&plusmn"]="177";entityToCharacterMap["&sup2"]="178";entityToCharacterMap["&sup3"]="179";entityToCharacterMap["&acute"]="180";entityToCharacterMap["&micro"]="181";entityToCharacterMap["&para"]="182";entityToCharacterMap["&middot"]="183";entityToCharacterMap["&cedil"]="184";entityToCharacterMap["&sup1"]="185";entityToCharacterMap["&ordm"]="186";entityToCharacterMap["&raquo"]="187";entityToCharacterMap["&frac14"]="188";entityToCharacterMap["&frac12"]="189";entityToCharacterMap["&frac34"]="190";entityToCharacterMap["&iquest"]="191";entityToCharacterMap["&Agrave"]="192";entityToCharacterMap["&Aacute"]="193";entityToCharacterMap["&Acirc"]="194";entityToCharacterMap["&Atilde"]="195";entityToCharacterMap["&Auml"]="196";entityToCharacterMap["&Aring"]="197";entityToCharacterMap["&AElig"]="198";entityToCharacterMap["&Ccedil"]="199";entityToCharacterMap["&Egrave"]="200";entityToCharacterMap["&Eacute"]="201";entityToCharacterMap["&Ecirc"]="202";entityToCharacterMap["&Euml"]="203";entityToCharacterMap["&Igrave"]="204";entityToCharacterMap["&Iacute"]="205";entityToCharacterMap["&Icirc"]="206";entityToCharacterMap["&Iuml"]="207";entityToCharacterMap["&ETH"]="208";entityToCharacterMap["&Ntilde"]="209";entityToCharacterMap["&Ograve"]="210";entityToCharacterMap["&Oacute"]="211";entityToCharacterMap["&Ocirc"]="212";entityToCharacterMap["&Otilde"]="213";entityToCharacterMap["&Ouml"]="214";entityToCharacterMap["&times"]="215";entityToCharacterMap["&Oslash"]="216";entityToCharacterMap["&Ugrave"]="217";entityToCharacterMap["&Uacute"]="218";entityToCharacterMap["&Ucirc"]="219";entityToCharacterMap["&Uuml"]="220";entityToCharacterMap["&Yacute"]="221";entityToCharacterMap["&THORN"]="222";entityToCharacterMap["&szlig"]="223";entityToCharacterMap["&agrave"]="224";entityToCharacterMap["&aacute"]="225";entityToCharacterMap["&acirc"]="226";entityToCharacterMap["&atilde"]="227";entityToCharacterMap["&auml"]="228";entityToCharacterMap["&aring"]="229";entityToCharacterMap["&aelig"]="230";entityToCharacterMap["&ccedil"]="231";entityToCharacterMap["&egrave"]="232";entityToCharacterMap["&eacute"]="233";entityToCharacterMap["&ecirc"]="234";entityToCharacterMap["&euml"]="235";entityToCharacterMap["&igrave"]="236";entityToCharacterMap["&iacute"]="237";entityToCharacterMap["&icirc"]="238";entityToCharacterMap["&iuml"]="239";entityToCharacterMap["&eth"]="240";entityToCharacterMap["&ntilde"]="241";entityToCharacterMap["&ograve"]="242";entityToCharacterMap["&oacute"]="243";entityToCharacterMap["&ocirc"]="244";entityToCharacterMap["&otilde"]="245";entityToCharacterMap["&ouml"]="246";entityToCharacterMap["&divide"]="247";entityToCharacterMap["&oslash"]="248";entityToCharacterMap["&ugrave"]="249";entityToCharacterMap["&uacute"]="250";entityToCharacterMap["&ucirc"]="251";entityToCharacterMap["&uuml"]="252";entityToCharacterMap["&yacute"]="253";entityToCharacterMap["&thorn"]="254";entityToCharacterMap["&yuml"]="255";entityToCharacterMap["&OElig"]="338";entityToCharacterMap["&oelig"]="339";entityToCharacterMap["&Scaron"]="352";entityToCharacterMap["&scaron"]="353";entityToCharacterMap["&Yuml"]="376";entityToCharacterMap["&fnof"]="402";entityToCharacterMap["&circ"]="710";entityToCharacterMap["&tilde"]="732";entityToCharacterMap["&Alpha"]="913";entityToCharacterMap["&Beta"]="914";entityToCharacterMap["&Gamma"]="915";entityToCharacterMap["&Delta"]="916";
entityToCharacterMap["&Epsilon"]="917";entityToCharacterMap["&Zeta"]="918";entityToCharacterMap["&Eta"]="919";entityToCharacterMap["&Theta"]="920";entityToCharacterMap["&Iota"]="921";entityToCharacterMap["&Kappa"]="922";entityToCharacterMap["&Lambda"]="923";entityToCharacterMap["&Mu"]="924";entityToCharacterMap["&Nu"]="925";entityToCharacterMap["&Xi"]="926";entityToCharacterMap["&Omicron"]="927";entityToCharacterMap["&Pi"]="928";entityToCharacterMap["&Rho"]="929";entityToCharacterMap["&Sigma"]="931";entityToCharacterMap["&Tau"]="932";entityToCharacterMap["&Upsilon"]="933";entityToCharacterMap["&Phi"]="934";entityToCharacterMap["&Chi"]="935";entityToCharacterMap["&Psi"]="936";entityToCharacterMap["&Omega"]="937";entityToCharacterMap["&alpha"]="945";entityToCharacterMap["&beta"]="946";entityToCharacterMap["&gamma"]="947";entityToCharacterMap["&delta"]="948";entityToCharacterMap["&epsilon"]="949";entityToCharacterMap["&zeta"]="950";entityToCharacterMap["&eta"]="951";entityToCharacterMap["&theta"]="952";entityToCharacterMap["&iota"]="953";entityToCharacterMap["&kappa"]="954";entityToCharacterMap["&lambda"]="955";entityToCharacterMap["&mu"]="956";entityToCharacterMap["&nu"]="957";entityToCharacterMap["&xi"]="958";entityToCharacterMap["&omicron"]="959";entityToCharacterMap["&pi"]="960";entityToCharacterMap["&rho"]="961";entityToCharacterMap["&sigmaf"]="962";entityToCharacterMap["&sigma"]="963";entityToCharacterMap["&tau"]="964";entityToCharacterMap["&upsilon"]="965";entityToCharacterMap["&phi"]="966";entityToCharacterMap["&chi"]="967";entityToCharacterMap["&psi"]="968";entityToCharacterMap["&omega"]="969";entityToCharacterMap["&thetasym"]="977";entityToCharacterMap["&upsih"]="978";entityToCharacterMap["&piv"]="982";entityToCharacterMap["&ensp"]="8194";entityToCharacterMap["&emsp"]="8195";entityToCharacterMap["&thinsp"]="8201";entityToCharacterMap["&zwnj"]="8204";entityToCharacterMap["&zwj"]="8205";entityToCharacterMap["&lrm"]="8206";entityToCharacterMap["&rlm"]="8207";entityToCharacterMap["&ndash"]="8211";entityToCharacterMap["&mdash"]="8212";entityToCharacterMap["&lsquo"]="8216";entityToCharacterMap["&rsquo"]="8217";entityToCharacterMap["&sbquo"]="8218";entityToCharacterMap["&ldquo"]="8220";entityToCharacterMap["&rdquo"]="8221";entityToCharacterMap["&bdquo"]="8222";entityToCharacterMap["&dagger"]="8224";entityToCharacterMap["&Dagger"]="8225";entityToCharacterMap["&bull"]="8226";entityToCharacterMap["&hellip"]="8230";entityToCharacterMap["&permil"]="8240";entityToCharacterMap["&prime"]="8242";entityToCharacterMap["&Prime"]="8243";entityToCharacterMap["&lsaquo"]="8249";entityToCharacterMap["&rsaquo"]="8250";entityToCharacterMap["&oline"]="8254";entityToCharacterMap["&frasl"]="8260";entityToCharacterMap["&euro"]="8364";entityToCharacterMap["&image"]="8365";entityToCharacterMap["&weierp"]="8472";entityToCharacterMap["&real"]="8476";entityToCharacterMap["&trade"]="8482";entityToCharacterMap["&alefsym"]="8501";entityToCharacterMap["&larr"]="8592";entityToCharacterMap["&uarr"]="8593";entityToCharacterMap["&rarr"]="8594";entityToCharacterMap["&darr"]="8595";entityToCharacterMap["&harr"]="8596";entityToCharacterMap["&crarr"]="8629";entityToCharacterMap["&lArr"]="8656";entityToCharacterMap["&uArr"]="8657";entityToCharacterMap["&rArr"]="8658";entityToCharacterMap["&dArr"]="8659";entityToCharacterMap["&hArr"]="8660";entityToCharacterMap["&forall"]="8704";entityToCharacterMap["&part"]="8706";entityToCharacterMap["&exist"]="8707";entityToCharacterMap["&empty"]="8709";entityToCharacterMap["&nabla"]="8711";entityToCharacterMap["&isin"]="8712";entityToCharacterMap["&notin"]="8713";entityToCharacterMap["&ni"]="8715";entityToCharacterMap["&prod"]="8719";entityToCharacterMap["&sum"]="8721";entityToCharacterMap["&minus"]="8722";entityToCharacterMap["&lowast"]="8727";entityToCharacterMap["&radic"]="8730";entityToCharacterMap["&prop"]="8733";entityToCharacterMap["&infin"]="8734";entityToCharacterMap["&ang"]="8736";entityToCharacterMap["&and"]="8743";entityToCharacterMap["&or"]="8744";entityToCharacterMap["&cap"]="8745";entityToCharacterMap["&cup"]="8746";entityToCharacterMap["&int"]="8747";entityToCharacterMap["&there4"]="8756";entityToCharacterMap["&sim"]="8764";entityToCharacterMap["&cong"]="8773";entityToCharacterMap["&asymp"]="8776";entityToCharacterMap["&ne"]="8800";entityToCharacterMap["&equiv"]="8801";entityToCharacterMap["&le"]="8804";entityToCharacterMap["&ge"]="8805";entityToCharacterMap["&sub"]="8834";entityToCharacterMap["&sup"]="8835";entityToCharacterMap["&nsub"]="8836";entityToCharacterMap["&sube"]="8838";entityToCharacterMap["&supe"]="8839";entityToCharacterMap["&oplus"]="8853";entityToCharacterMap["&otimes"]="8855";entityToCharacterMap["&perp"]="8869";entityToCharacterMap["&sdot"]="8901";entityToCharacterMap["&lceil"]="8968";entityToCharacterMap["&rceil"]="8969";entityToCharacterMap["&lfloor"]="8970";entityToCharacterMap["&rfloor"]="8971";entityToCharacterMap["&lang"]="9001";entityToCharacterMap["&rang"]="9002";entityToCharacterMap["&loz"]="9674";
entityToCharacterMap["&spades"]="9824";entityToCharacterMap["&clubs"]="9827";entityToCharacterMap["&hearts"]="9829";entityToCharacterMap["&diams"]="9830";var characterToEntityMap=[];for(var entity in entityToCharacterMap){characterToEntityMap[entityToCharacterMap[entity]]=entity}$namespace("org.owasp.esapi.codecs");org.owasp.esapi.codecs.HTMLEntityCodec=function(){var f=new org.owasp.esapi.codecs.Codec();var a=function(g){var h=g.peek();if(h==null){return null}if(h=="x"||h=="X"){g.next();return d(g)}return e(g)};var e=function(g){var h="";while(g.hasNext()){var j=g.peek();if(j.match(/[0-9]/)){h+=j;g.next()}else{if(j==";"){g.next();break}else{break}}}try{return parseInt(h)}catch(i){return null}};var d=function(g){var h="";while(g.hasNext()){var j=g.peek();if(j.match(/[0-9A-Fa-f]/)){h+=j;g.next()}else{if(j==";"){g.next();break}else{break}}}try{return parseInt(h,16)}catch(i){return null}};var b=function(h){var g="";while(h.hasNext()){var i=h.peek();if(i.match(/[A-Za-z]/)){g+=i;h.next();if(entityToCharacterMap.containsKey("&"+g)){if(h.peek(";")){h.next()}break}}else{if(i==";"){h.next()}else{break}}}return String.fromCharCode(entityToCharacterMap.getCaseInsensitive("&"+g))};return{encode:f.encode,decode:f.decode,encodeCharacter:function(h,k){if(h.contains(k)){return k}var i=org.owasp.esapi.codecs.Codec.getHexForNonAlphanumeric(k);if(i==null){return k}var j=k.charCodeAt(0);if((j<=31&&k!="\t"&&k!="\n"&&k!="\r")||(j>=127&&j<=159)||k==" "){return" "}var g=characterToEntityMap[j];if(g!=null){return g+";"}return"&#x"+i+";"},decodeCharacter:function(k){var g=k;g.mark();var i=g.next();if(i==null||i!="&"){g.reset();return null}var h=g.next();if(h==null){g.reset();return null}if(h=="#"){var j=a(g);if(j!=null){return j}}else{if(h.match(/[A-Za-z]/)){g.pushback(h);j=b(g);if(j!=null){return j}}}g.reset();return null}}};$namespace("org.owasp.esapi.codecs");org.owasp.esapi.codecs.JavascriptCodec=function(){var a=new org.owasp.esapi.codecs.Codec();return{encode:function(f,h){var d="";for(var b=0;b<h.length;b++){var g=h.charAt(b);if(f.contains(g)){d+=g}else{var i=org.owasp.esapi.codecs.Codec.getHexForNonAlphanumeric(g);if(i==null){d+=g}else{var e=g.charCodeAt(0).toString(16);if(g.charCodeAt(0)<256){var j="00".substr(e.length);d+="\\x"+j+e.toUpperCase()}else{j="0000".substr(e.length);d+="\\u"+j+e.toUpperCase()}}}}return d},decode:a.decode,decodeCharacter:function(p){p.mark();var k=p.next();if(k==null){p.reset();return null}if(k!="\\"){p.reset();return null}var b=p.next();if(b==null){p.reset();return null}if(b=="b"){return 8}else{if(b=="t"){return 9}else{if(b=="n"){return 10}else{if(b=="v"){return 11}else{if(b=="f"){return 12}else{if(b=="r"){return 13}else{if(b=='"'){return 34}else{if(b=="'"){return 39}else{if(b=="\\"){return 92}else{if(b.toLowerCase()=="x"){h="";for(var j=0;j<2;j++){var m=p.nextHex();if(m!=null){h+=m}else{input.reset();return null}}try{d=parseInt(h,16);return String.fromCharCode(d)}catch(l){p.reset();return null}}else{if(b.toLowerCase()=="u"){h="";for(j=0;j<4;j++){m=p.nextHex();if(m!=null){h+=m}else{input.reset();return null}}try{var d=parseInt(h,16);return String.fromCharCode(d)}catch(l){p.reset();return null}}else{if(p.isOctalDigit(b)){var h=b;var g=p.next();if(!p.isOctalDigit(g)){p.pushback(g)}else{h+=g;var f=p.next();if(!p.isOctalDigit(f)){p.pushback(f)}else{h+=f}}try{d=parseInt(h,8);return String.fromCharCode(d)}catch(l){p.reset();return null}}}}}}}}}}}}}return b}}};$namespace("org.owasp.esapi.codecs");org.owasp.esapi.codecs.PercentCodec=function(){var e=new org.owasp.esapi.codecs.Codec();var d="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";var b="-._~";var a=true;var g=d+(a?"":b);var f=function(h){var i="";if(h<-128||h>127){throw new IllegalArgumentException("b is not a byte (was "+h+")")}h&=255;if(h<16){i+="0"}return i+h.toString(16).toUpperCase()};return{encode:e.encode,decode:e.decode,encodeCharacter:function(k,l){if(g.indexOf(l)>-1){return l}var i=org.owasp.esapi.codecs.UTF8.encode(l);var j="";for(var h=0;h<i.length;h++){j+="%"+f(i.charCodeAt(h))}return j},decodeCharacter:function(q){q.mark();var l=q.next();if(l==null||l!="%"){q.reset();return null}var h="";for(var j=0;j<2;j++){var p=q.nextHex();if(p!=null){h+=p}}if(h.length==2){try{var m=parseInt(h,16);return String.fromCharCode(m)}catch(k){}}q.reset();return null}}};$namespace("org.owasp.esapi.codecs");org.owasp.esapi.codecs.PushbackString=function(b){var e=b,g="",a="",f=0,d=0;return{pushback:function(h){g=h},index:function(){return f},hasNext:function(){if(g!=null){return true}return !(e==null||e.length==0||f>=e.length)},next:function(){if(g!=null){var h=g;g=null;return h}if(e==null||e.length==0||f>=e.length){return null}return e.charAt(f++)},nextHex:function(){var h=this.next();if(this.isHexDigit(h)){return h}return null},nextOctal:function(){var h=this.next();if(this.isOctalDigit(h)){return h}return null},isHexDigit:function(h){return h!=null&&((h>="0"&&h<="9")||(h>="a"&&h<="f")||(h>="A"&&h<="F"))},isOctalDigit:function(h){return h!=null&&(h>="0"&&h<="7")
},peek:function(h){if(!h){if(g!=null){return g}if(e==null||e.length==0||f>=e.length){return null}return e.charAt(f)}else{if(g!=null&&g==h){return true}if(e==null||e.length==0||f>=e.length){return false}return e.charAt(f)==h}},mark:function(){a=g;d=f},reset:function(){g=a;f=d},remainder:function(){var h=e.substr(f);if(g!=null){h=g+h}return h}}};$namespace("org.owasp.esapi.codecs");org.owasp.esapi.codecs.UTF8={encode:function(d){var b=d.replace(/\r\n/g,"\n");var a="";for(var f=0;f<b.length;f++){var e=b.charCodeAt(f);if(e<128){a+=String.fromCharCode(e)}else{if((e>127)&&(e<2048)){a+=String.fromCharCode((e>>6)|192);a+=String.fromCharCode((e&63)|128)}else{a+=String.fromCharCode((e>>12)|224);a+=String.fromCharCode(((e>>6)&63)|128);a+=String.fromCharCode((e&63)|128)}}}return a},decode:function(d){var a="";var b=c=c1=c2=0;while(b<d.length){c=d.charCodeAt(b);if(c<128){a+=String.fromCharCode(c);b++}else{if((c>191)&&(c<224)){c2=d.charCodeAt(b+1);a+=String.fromCharCode(((c&31)<<6)|(c2&63));b+=2}else{c2=utftext.charCodeAt(b+1);c3=utftext.charCodeAt(b+2);string+=String.fromCharCode(((c&15)<<12)|((c2&63)<<6)|(c3&63));b+=3}}}return a}};$namespace("org.owasp.esapi.i18n");org.owasp.esapi.i18n.ArrayResourceBundle=function(sName,oLocale,aMessages,oParent){with(org.owasp.esapi.i18n){var _super=new ResourceBundle(sName,oLocale,oParent)}var messages=aMessages;return{getParent:_super.getParent,getLocale:_super.getLocale,getName:_super.getName,getString:_super.getString,getMessage:function(sKey){return messages[sKey]}}};$namespace("org.owasp.esapi.i18n");org.owasp.esapi.i18n.Locale=function(f,d,a){var g=f,e=d,b=a;return{getLanguage:function(){return g},getCountry:function(){return e},getVariant:function(){return b},toString:function(){return g+(e?"-"+e+(b?"-"+b:""):"")}}};org.owasp.esapi.i18n.Locale.US=new org.owasp.esapi.i18n.Locale("en","US");org.owasp.esapi.i18n.Locale.GB=new org.owasp.esapi.i18n.Locale("en","GB");org.owasp.esapi.i18n.Locale.getLocale=function(b){var a=b.split("-");return new org.owasp.esapi.i18n.Locale(a[0],(a.length>1?a[1]:""),(a.length>2?a.length[2]:""))};org.owasp.esapi.i18n.Locale.getDefault=function(){var a=(navigator.language?navigator.language:(navigator.userLanguage?navigator.userLanguage:"en-US")).split("-");return new org.owasp.esapi.i18n.Locale(a[0],(a.length>1?a[1]:""),(a.length>2?a.length[2]:""))};$namespace("org.owasp.esapi.i18n");org.owasp.esapi.i18n.ObjectResourceBundle=function(e,d){var b=new org.owasp.esapi.i18n.ResourceBundle(e.name,org.owasp.esapi.i18n.Locale.getLocale(e.locale),d);var a=e.messages;return{getParent:b.getParent,getLocale:b.getLocale,getName:b.getName,getString:b.getString,getMessage:function(f){return a[f]}}};$namespace("org.owasp.esapi.i18n");org.owasp.esapi.i18n.ResourceBundle=function(g,e,b){var f=b;var a=e;var d=g;if(!d){throw new SyntaxError("Name required for implementations of org.owasp.esapi.i18n.ResourceBundle")}if(!a){throw new SyntaxError("Locale required for implementations of org.owasp.esapi.i18n.ResourceBundle")}return{getParent:function(){return f},getLocale:function(){return a},getName:function(){return d},getMessage:function(h){return h},getString:function(l,p){if(arguments.length<1){throw new IllegalArgumentException("No key passed to getString")}var m=this.getMessage(l);if(!m){if(f){return f.getString(l,p)}else{return l}}if(!m.match(/\{([A-Za-z]+)\}/)||!p){return m}var h="",n=0;while(true){var j=m.indexOf("{",n);var k=m.indexOf("}",j);if(j<0){h+=m.substr(n,m.length-n);break}if(j>=0&&k<-1){throw new SyntaxError("Invalid Message - Unclosed Context Reference: "+m)}h+=m.substring(n,j);var i=m.substring(j+1,k);if(p[i]){h+=p[i]}else{h+=m.substring(j,k+1)}n=k+1}return h}}};org.owasp.esapi.i18n.ResourceBundle.getResourceBundle=function(sResource,oLocale){var classname=sResource+"_"+oLocale.toString().replace("-","_");with(org.owasp.esapi.i18n){if(ResourceBundle[classname] instanceof Object){return ResourceBundle[classname]}else{return new ResourceBundle[classname]()}}};$namespace("org.owasp.esapi.net");org.owasp.esapi.net.Cookie=function(g,n){var b;var m;var h;var f;var l;var p;var a;var k;var d=$ESAPI.resourceBundle();var i=",; ";var e=function(u){for(var r=0,q=u.length;r<q;r++){var t=u.charCodeAt(r),s=u.charAt(r);if(t<32||t>=127||i.indexOf(s)!=-1){return false}}return true};if(!e(g)||g.toLowerCase()=="comment"||g.toLowerCase()=="discard"||g.toLowerCase()=="domain"||g.toLowerCase()=="expires"||g.toLowerCase()=="max-age"||g.toLowerCase()=="path"||g.toLowerCase()=="secure"||g.toLowerCase()=="version"||g.charAt(0)=="$"){var j=d.getString("Cookie.Name",{name:g});throw new IllegalArgumentException(j)}b=g;m=n;return{setComment:function(q){h=q},getComment:function(){return h},setDomain:function(q){f=q.toLowerCase()},getDomain:function(){return f},setMaxAge:function(q){l=q},getMaxAge:function(){return l},setPath:function(q){p=q},getPath:function(){return p},setSecure:function(q){a=q},getSecure:function(){return a},getName:function(){return b},setValue:function(q){m=q},getValue:function(){return m
},setVersion:function(q){if(q<0||q>1){throw new IllegalArgumentException(d.getString("Cookie.Version",{version:q}))}k=q},getVersion:function(){return k}}};$namespace("org.owasp.esapi.reference.encoding");org.owasp.esapi.reference.encoding.DefaultEncoder=function(a){var h=[],k=new org.owasp.esapi.codecs.HTMLEntityCodec(),f=new org.owasp.esapi.codecs.JavascriptCodec(),g=new org.owasp.esapi.codecs.CSSCodec(),b=new org.owasp.esapi.codecs.PercentCodec();if(!a){h.push(k);h.push(f);h.push(g);h.push(b)}else{h=a}var e=new Array(",",".","-","_"," ");var d=new Array(",",".","-","_");var j=new Array();var i=new Array(",",".","_");return{canonicalize:function(r,m){if(!r){return null}var l=r,p=null,s=1,n=0,q=false;while(!q){q=true;h.each(function(u){var t=l;l=u.decode(l);if(t!=l){if(p!=null&&p!=u){s++}p=u;if(q){n++}q=false}})}if(n>=2&&s>1){if(m){throw new org.owasp.esapi.IntrusionException("Input validation failure","Multiple ("+n+"x) and mixed encoding ("+s+"x) detected in "+r)}}else{if(n>=2){if(m){throw new org.owasp.esapi.IntrusionException("Input validation failure","Multiple ("+n+"x) encoding detected in "+r)}}else{if(s>1){if(m){throw new org.owasp.esapi.IntrusionException("Input validation failure","Mixed ("+s+"x) encoding detected in "+r)}}}}return l},normalize:function(l){return l.replace(/[^\x00-\x7F]/g,"")},encodeForHTML:function(l){return !l?null:k.encode(e,l)},decodeForHTML:function(l){return !l?null:k.decode(l)},encodeForHTMLAttribute:function(l){return !l?null:k.encode(d,l)},encodeForCSS:function(l){return !l?null:g.encode(j,l)},encodeForJavaScript:function(l){return !l?null:f.encode(i,l)},encodeForJavascript:this.encodeForJavaScript,encodeForURL:function(l){return !l?null:escape(l)},decodeFromURL:function(l){return !l?null:unescape(l)},encodeForBase64:function(l){return !l?null:org.owasp.esapi.codecs.Base64.encode(l)},decodeFromBase64:function(l){return !l?null:org.owasp.esapi.codecs.Base64.decode(l)}}};$namespace("org.owasp.esapi.reference.logging");org.owasp.esapi.reference.logging.Log4JSLogFactory=function(){var d=Array();var b=function(m){var f=null;var e=m?m:null;var k=Log4js.Level;var i=false,j=false,l=false,h=$ESAPI.encoder().encodeForHTML;f=Log4js.getLogger(e);var g=function(p){var n=org.owasp.esapi.Logger;switch(p){case n.OFF:return Log4js.Level.OFF;case n.FATAL:return Log4js.Level.FATAL;case n.ERROR:return Log4js.Level.ERROR;case n.WARNING:return Log4js.Level.WARN;case n.INFO:return Log4js.Level.INFO;case n.DEBUG:return Log4js.Level.DEBUG;case n.TRACE:return Log4js.Level.TRACE;case n.ALL:return Log4js.Level.ALL}};return{setLevel:function(n){try{f.setLevel(g(n))}catch(p){this.error(org.owasp.esapi.Logger.SECURITY_FAILURE,"",p)}},trace:function(p,n,q){this.log(k.TRACE,p,n,q)},debug:function(p,n,q){this.log(k.DEBUG,p,n,q)},info:function(p,n,q){this.log(k.INFO,p,n,q)},warning:function(p,n,q){this.log(k.WARN,p,n,q)},error:function(p,n,q){this.log(k.ERROR,p,n,q)},fatal:function(p,n,q){this.log(k.FATAL,p,n,q)},log:function(s,r,p,t){switch(s){case k.TRACE:if(!f.isTraceEnabled()){return}break;case k.DEBUG:if(!f.isDebugEnabled()){return}break;case k.INFO:if(!f.isInfoEnabled()){return}break;case k.WARNING:if(!f.isWarnEnabled()){return}break;case k.ERROR:if(!f.isErrorEnabled()){return}break;case k.FATAL:if(!f.isFatalEnabled()){return}break}if(!p){p=""}p="["+r.toString()+"] - "+p;var n=p.replace("\n","_").replace("\r","_");if(l){n=h(n);if(n!=p){n+=" [Encoded]"}}var q=(i?window.location.href:"")+(j?"/"+$ESAPI.properties.application.Name:"");f.log(s,(q!=""?"["+q+"] ":"")+n,t)},addAppender:function(n){f.addAppender(n)},isLogUrl:function(){return i},setLogUrl:function(n){i=n},isLogApplicationName:function(){return j},setLogApplicationName:function(n){j=n},isEncodingRequired:function(){return l},setEncodingRequired:function(n){l=n},setEncodingFunction:function(n){h=n},isDebugEnabled:function(){return f.isDebugEnabled()},isErrorEnabled:function(){return f.isErrorEnabled()},isFatalEnabled:function(){return f.isFatalEnabled()},isInfoEnabled:function(){return f.isInfoEnabled()},isTraceEnabled:function(){return f.isTraceEnabled()},isWarningEnabled:function(){return f.isWarnEnabled()}}};var a=function(f){var e=$ESAPI.properties.logging;if(e[f]){e=e[f]}return e};return{getLogger:function(g){var h=(typeof g=="string")?g:g.constructor.toString();var f=d[h];if(!f){f=new b(h);var e=a(g);f.setLevel(e.Level);f.setLogUrl(e.LogUrl);f.setLogApplicationName(e.LogApplicationName);f.setEncodingRequired(e.EncodingRequired);if(e.EncodingFunction){f.setEncodingFunction(e.EncodingFunction)}e.Appenders.each(function(i){if(e.Layout){i.setLayout(e.Layout)}f.addAppender(i)});d[h]=f}return f}}};$namespace("org.owasp.esapi.reference.validation");org.owasp.esapi.reference.validation.BaseValidationRule=function(f,h,a){var g=$ESAPI.logger("Validation");var b=org.owasp.esapi.Logger.EventType;var i=f;var j=h?h:$ESAPI.encoder();var l=false;var e=org.owasp.esapi.i18n.ResourceBundle;var k=a?a:$ESAPI.locale();var d;if($ESAPI.properties.validation.ResourceBundle){d=e.getResourceBundle($ESAPI.properties.validation.ResourceBundle,k)
}if(!d){d=$ESAPI.resourceBundle();g.info(b.EVENT_FAILURE,"No Validation ResourceBundle - Defaulting to "+d.getName()+"("+d.getLocale().toString()+")")}g.info(b.EVENT_SUCCESS,"Validation Rule Initialized with ResourceBundle: "+d.getName());return{setAllowNull:function(m){l=m},isAllowNull:function(){return l},getTypeName:function(){return i},setTypeName:function(m){i=m},setEncoder:function(m){j=m},getEncoder:function(){return j},assertValid:function(m,n){this.getValid(m,n)},getValid:function(m,p,r){var q=null;try{q=this.getValidInput(m,p)}catch(n){return this.sanitize(m,p)}return q},getValidInput:function(m,n){return n},getSafe:function(m,p){var q=null;try{q=this.getValidInput(m,p)}catch(n){return this.sanitize(m,p)}return q},sanitize:function(m,n){return n},isValid:function(m,p){var q=false;try{this.getValidInput(m,p);q=true}catch(n){return false}return q},whitelist:function(n,p){var q="";for(var m=0;m<n.length;m++){var r=n.charAt(m);if(p.contains(r)){q+=r}}return q},getUserMessage:function(p,m,n){return this.getMessage(p+".Usr",m+".Usr",n)},getLogMessage:function(p,m,n){return this.getMessage(p+".Log",m+".Log",n)},getMessage:function(p,m,n){return d.getString(p,n)?d.getString(p,n):d.getString(m,n)},validationException:function(p,m,q,n){throw new org.owasp.esapi.reference.validation.ValidationException(this.getUserMessage(p+"."+q,m+"."+q,n),this.getLogMessage(p+"."+q,m+"."+q,n),p)}}};$namespace("org.owasp.esapi.reference.validation");org.owasp.esapi.reference.validation.CreditCardValidationRule=function(b,f,a){var j=new org.owasp.esapi.reference.validation.BaseValidationRule(b,f,a);var h="CreditCard";var d=19;var g;var e=function(){var l=new RegExp($ESAPI.properties.validation.CreditCard);var k=new org.owasp.esapi.reference.validation.StringValidationRule("ccrule",j.getEncoder(),a,l);k.setMaxLength(d);k.setAllowNull(false);return k};ccRule=e();var i=function(k){var s="";var q;for(var n=0;o<k.length;n++){q=k.charAt(n);if(q.match(/[0-9]/)){s+=q}}var p=0,r=0,l=0,t=false;for(var m=s.length-1;m>=0;m--){r=parseInt(s.substring(m,n+1));if(t){l=r*2;if(l>9){l-=9}}else{l=r}p+=l;t=!t}return p%10==0};return{getMaxCardLength:function(){return d},setMaxCardLength:function(k){d=k},setAllowNull:j.setAllowNull,isAllowNull:j.isAllowNull,getTypeName:j.getTypeName,setTypeName:j.setTypeName,setEncoder:j.setEncoder,getEncoder:j.getEncoder,assertValid:j.assertValid,getValid:j.getValid,getValidInput:function(l,m){if(!m||m.trim()==""){if(this.isAllowNull()){return null}j.validationException(l,h,"Required",{context:l,input:m})}var k=g.getValid(l,m);if(!i(k)){j.validationException(l,h,"Invalid",{context:l,input:m})}return k},getSafe:j.getSafe,sanitize:function(k,l){return this.whitelist(l,org.owasp.esapi.EncoderConstants.CHAR_DIGITS)},isValid:j.isValid,whitelist:j.whitelist}};$namespace("org.owasp.esapi.reference.validation");org.owasp.esapi.reference.validation.DateValidationRule=function(a,d,b){var f=new org.owasp.esapi.reference.validation.BaseValidationRule(a,d,b);var h="Date";var g=DateFormat.getDateInstance();var e=function(j,k){if(!j||j.trim()==""){if(f.isAllowNull()){return null}f.validationException(j,h,"Required",{context:j,input:k,format:g})}var i=f.getEncoder().canonicalize(k);try{return g.parse(i)}catch(l){f.validationException(j,h,"Invalid",{context:j,input:k,format:g})}};return{setDateFormat:function(i){if(!i){throw new IllegalArgumentException("DateValidationRule.setDateFormat requires a non-null DateFormat")}g=i},setAllowNull:f.setAllowNull,isAllowNull:f.isAllowNull,getTypeName:f.getTypeName,setTypeName:f.setTypeName,setEncoder:f.setEncoder,getEncoder:f.getEncoder,assertValid:f.assertValid,getValid:f.getValid,getValidInput:function(i,j){return e(i,j)},getSafe:f.getSafe,sanitize:function(i,k){var j=new Date(0);try{j=e(i,k)}catch(l){}return j},isValid:f.isValid,whitelist:f.whitelist}};$namespace("org.owasp.esapi.reference.validation");org.owasp.esapi.reference.validation.DefaultValidator=function(e,b){var g=Array();var d=e?e:$ESAPI.encoder();var a=b?b:org.owasp.esapi.i18n.Locale.getDefault();var f=org.owasp.esapi.reference.validation;return{addRule:function(h){g[h.getName()]=h},getRule:function(h){return g[h]},isValidInput:function(h,k,m,j,i){try{this.getValidInput(h,k,m,j,i);return true}catch(l){return false}},getValidInput:function(i,q,h,l,k,r){var n=new org.owasp.esapi.reference.validation.StringValidationRule(h,d,a);var j=new RegExp($ESAPI.properties.validation[h]);if(j&&j instanceof RegExp){n.addWhitelistPattern(j)}else{throw new IllegalArgumentException("Invalid Type: "+h+" not found.")}n.setMaxLength(l);n.setAllowNull(k);try{return n.getValid(i,q)}catch(m){if(m instanceof j.ValidationErrorList&&r){r.addError(i,m)}throw m}},isValidDate:function(i,k,h,j){try{this.getValidDate(i,k,h,j);return true}catch(l){return false}},getValidDate:function(i,k,h,j,n){var l=new f.DateValidationRule(i,d,a);l.setAllowNull(j);l.setDateFormat(h);try{return l.getValid(i,k)}catch(m){if(m instanceof f.ValidationErrorList&&n){n.addError(i,m)
}throw m}},getValidCreditCard:function(h,j,i,m){var k=new f.CreditCardValidationRule(h,d,a);k.setAllowNull(i);try{return k.getValid(h,j)}catch(l){if(l instanceof f.ValidationErrorList&&m){m.addError(h,l)}throw l}},isValidCreditCard:function(h,j,i){try{this.getValidCreditCard(h,j,i);return true}catch(k){return false}},getValidNumber:function(i,k,j,n,p,m){var h=new f.NumberValidationRule(i,d,a,n,p);h.setAllowNull(j);try{return h.getValid(i,k)}catch(l){if(l instanceof f.ValidationErrorList&&m){m.addError(i,l)}throw l}},isValidNumber:function(h,j,i,l,m){try{this.getValidNumber(h,j,i,l,m);return true}catch(k){return false}},getValidInteger:function(i,k,j,n,p,m){var h=new f.IntegerValidationRule(i,d,a,n,p);h.setAllowNull(j);try{return h.getValid(i,k)}catch(l){if(l instanceof f.ValidationErrorList&&m){m.addError(i,l)}throw l}},isValidInteger:function(h,j,i,l,m){try{this.getValidInteger(h,j,i,l,m);return true}catch(k){return false}}}};$namespace("org.owasp.esapi.reference.validation");org.owasp.esapi.reference.validation.IntegerValidationRule=function(b,e,a,k,h){var j=new org.owasp.esapi.reference.validation.BaseValidationRule(b,e,a);var d="Integer";var i=k?k:Number.MIN_VALUE;var f=h?h:Number.MAX_VALUE;if(i>=f){throw new IllegalArgumentException("minValue must be less than maxValue")}var g=function(m,p){if(!p||p.trim()==""){if(j.allowNull()){return null}j.validationException(m,d,"Required",{context:m,input:p,minValue:i,maxValue:f})}var l=j.getEncoder().canonicalize(p);var q=parseInt(l);if(q=="NaN"){j.validationException(m,d,"NaN",{context:m,input:p,minValue:i,maxValue:f})}if(q<i){j.validationException(m,d,"MinValue",{context:m,input:p,minValue:i,maxValue:f})}if(q>f){j.validationException(m,d,"MaxValue",{context:m,input:p,minValue:i,maxValue:f})}return q};return{setMinValue:function(l){i=l},getMinValue:function(){return i},setMaxValue:function(l){f=l},getMaxValue:function(){return f},setAllowNull:j.setAllowNull,isAllowNull:j.isAllowNull,getTypeName:j.getTypeName,setTypeName:j.setTypeName,setEncoder:j.setEncoder,getEncoder:j.getEncoder,assertValid:j.assertValid,getValid:j.getValid,getValidInput:function(l,m){return g(l,m)},getSafe:j.getSafe,sanitize:function(l,m){var q=0;try{q=g(l,m)}catch(p){}return q},isValid:j.isValid,whitelist:j.whitelist}};$namespace("org.owasp.esapi.reference.validation");org.owasp.esapi.reference.validation.NumberValidationRule=function(b,f,a,h,e){var k=new org.owasp.esapi.reference.validation.BaseValidationRule(b,f,a);var d="Number";var j=h?h:Number.MIN_VALUE;var g=e?e:Number.MAX_VALUE;if(j>=g){throw new IllegalArgumentException("MinValue must be less that MaxValue")}var i=function(m,n){if(!n||n.trim()==""){if(k.isAllowNull()){return null}k.validationException(m,d,"Required",{context:m,input:n,minValue:j,maxValue:g})}var l=k.getEncoder().canonicalize(n);var p=0;try{p=parseFloat(l)}catch(q){k.validationException(m,d,"Invalid",{context:m,input:n,minValue:j,maxValue:g})}if(p=="NaN"){k.validationException(m,d,"NaN",{context:m,input:n,minValue:j,maxValue:g})}if(p<j){k.validationException(m,d,"MinValue",{context:m,input:n,minValue:j,maxValue:g})}if(p>g){k.validationException(m,d,"MaxValue",{context:m,input:n,minValue:j,maxValue:g})}return p};return{setMinValue:function(l){j=l},getMinValue:function(){return j},setMaxValue:function(l){g=l},getMaxValue:function(){return g},setAllowNull:k.setAllowNull,isAllowNull:k.isAllowNull,getTypeName:k.getTypeName,setTypeName:k.setTypeName,setEncoder:k.setEncoder,getEncoder:k.getEncoder,assertValid:k.assertValid,getValid:k.getValid,getValidInput:function(l,m){return i(l,m)},getSafe:k.getSafe,sanitize:function(l,m){var q=0;try{q=i(l,m)}catch(p){}return q},isValid:k.isValid,whitelist:k.whitelist}};$namespace("org.owasp.esapi.reference.validation");org.owasp.esapi.reference.validation.StringValidationRule=function(g,l,a,p){var q=new org.owasp.esapi.reference.validation.BaseValidationRule(g,l,a);var h="String";var n=Array();var f=Array();var e=0;var b=Number.MAX_VALUE;var m=true;if(p){if(p instanceof String){n.push(new RegExp(p))}else{if(p instanceof RegExp){n.push(p)}else{throw new IllegalArgumentException("sWhiteListPattern must be a string containing RegExp or a RegExp Object")}}}var k=function(r,t,s){n.each(function(u){if(t.match(u)){q.validationException(r,h,"Whitelist",{context:r,input:t,orig:s,pattern:u.toString(),minLength:e,maxLength:b,validateInputAndCanonical:m})}})};var j=function(r,t,s){f.each(function(u){if(t.match(u)){q.validationException(r,h,"Blacklist",{context:r,input:t,orig:s,pattern:u.toString(),minLength:e,maxLength:b,validateInputAndCanonical:m})}})};var d=function(r,t,s){if(t.length<e){q.validationException(r,h,"MinLength",{context:r,input:t,orig:s,minLength:e,maxLength:b,validateInputAndCanonical:m})}if(t.length>b){q.validationException(r,h,"MaxLength",{context:r,input:t,orig:s,minLength:e,maxLength:b,validateInputAndCanonical:m})}return t};var i=function(r,t,s){if(!t||t.trim()==""){if(q.isAllowNull()){return null}q.validationException(r,h,"Required",{context:r,input:t,orig:s,minLength:e,maxLength:b,validateInputAndCanonical:m})
}};return{addWhitelistPattern:function(r){if(r instanceof String){n.push(new RegExp(r))}else{if(r instanceof RegExp){n.push(r)}else{throw new IllegalArgumentException("p must be a string containing RegExp or a RegExp Object")}}},addBlacklistPattern:function(r){if(r instanceof String){f.push(new RegExp(r))}else{if(r instanceof RegExp){f.push(r)}else{throw new IllegalArgumentException("p must be a string containing RegExp or a RegExp Object")}}},setMinLength:function(r){e=r},getMinLength:function(){return e},setMaxLength:function(r){b=r},getMaxLength:function(){return b},setValidateInputAndCanonical:function(r){m=r},isValidateInputAndCanonical:function(){return m},setAllowNull:q.setAllowNull,isAllowNull:q.isAllowNull,getTypeName:q.getTypeName,setTypeName:q.setTypeName,setEncoder:q.setEncoder,getEncoder:q.getEncoder,assertValid:q.assertValid,getValid:q.getValid,getValidInput:function(s,t){var r=null;if(i(s,t)==null){return null}if(m){d(s,t);k(s,t);j(s,t)}r=this.getEncoder().canonicalize(t);if(i(s,r,t)==null){return null}d(s,r,t);k(s,r,t);j(s,r,t);return r},getSafe:q.getSafe,sanitize:function(r,s){return this.whitelist(s,org.owasp.esapi.EncoderConstants.CHAR_ALNUM)},isValid:q.isValid,whitelist:q.whitelist}};$namespace("org.owasp.esapi.reference.validation");org.owasp.esapi.reference.validation.ValidationException=function(d,b){var f,a;if(arguments[2]&&arguments[2] instanceof Exception){f=arguments[2];if(arguments[3]&&arguments[3] instanceof String){a=arguments[3]}}else{if(arguments[2]&&arguments[2] instanceof String){a=arguments[2]}}var e=new org.owasp.esapi.EnterpriseSecurityException(d,b,f);return{setContext:function(g){a=g},getContext:function(){return a},getMessage:e.getMessage,getUserMessage:e.getMessage,getLogMessage:e.getLogMessage,getStackTrace:e.getStackTrace,printStackTrace:e.printStackTrace}};var ESAPI_Standard_en_US = {
    name: 'ESAPI Standard Messages - US English',
    locale: 'en-US',
    messages: {
        "Test"                              : "This is test #{testnumber}",

        // Messages for validation
        "CreditCard.Required.Usr"           : "{context}: Input credit card required",
        "CreditCard.Required.Log"           : "Input credit card required: context={context}, input={input}",
        "CreditCard.Invalid.Usr"            : "{context}: Invalid credit card input",
        "CreditCard.Invalid.Log"            : "Invalid credit card input: context={context}, input={input}",
        "Date.Required.Usr"                 : "{context}: Input date required in {format} format",
        "Date.Required.Log"                 : "Date required: context={context}, input={input}, format={format}",
        "Date.Invalid.Usr"                  : "{context}: Invalid date, please use {format} format",
        "Date.Invalid.Log"                  : "Invalid date: context={context}, input={input}, format={format}",
        "Integer.Required.Usr"              : "{context}: Input number required",
        "Integer.Required.Log"              : "Input number required: context={context}, input={input}, minValue={minValue}, maxValue={maxValue}",
        "Integer.NaN.Usr"                   : "{context}: Invalid number",
        "Integer.NaN.Log"                   : "Invalid number: context={context}, input={input}, minValue={minValue}, maxValue={maxValue}",
        "Integer.MinValue.Usr"              : "{context}: Invalid number - Must be greater than {minValue}",
        "Integer.MinValue.Log"              : "Invalid number: context={context}, input={input}, minValue={minValue}, maxValue={maxValue}",
        "Integer.MaxValue.Usr"              : "{context}: Invalid number - Must be less than {maxValue}",
        "Integer.MaxValue.Log"              : "Invalid number: context={context}, input={input}, minValue={minValue}, maxValue={maxValue}",
        "Number.Required.Usr"               : "{context}: Input number required",
        "Number.Required.Log"               : "Input number required: context={context}, input={input}, minValue={minValue}, maxValue={maxValue}",
        "Number.NaN.Usr"                    : "{context}: Invalid number",
        "Number.NaN.Log"                    : "Invalid number: context={context}, input={input}, minValue={minValue}, maxValue={maxValue}",
        "Number.MinValue.Usr"               : "{context}: Invalid number - Must be greater than {minValue}",
        "Number.MinValue.Log"               : "Invalid number: context={context}, input={input}, minValue={minValue}, maxValue={maxValue}",
        "Number.MaxValue.Usr"               : "{context}: Invalid number - Must be less than {maxValue}",
        "Number.MaxValue.Log"               : "Invalid number: context={context}, input={input}, minValue={minValue}, maxValue={maxValue}",
        "String.Required.Usr"               : "{context}: Input required",
        "String.Required.Log"               : "Input required: context={context}, input={input}, original={orig}",
        "String.Whitelist.Usr"              : "{context}: Invalid input - Conform to regex {pattern}",
        "String.Whitelist.Log"              : "Invalid input - Whitelist validation failed: context={context}, input={input}, original={orig}, pattern={pattern}",
        "String.Blacklist.Usr"              : "{context}: Invalid input - Dangerous input matching {pattern} detected",
        "String.Blacklist.Log"              : "Invalid input - Blacklist validation failed: context={context}, input={input}, original={orig}, pattern={pattern}",
        "String.MinLength.Usr"              : "{context}: Invalid input - Minimum length is {minLength}",
        "String.MinLength.Log"              : "Invalid input - Too short: context={context}, input={input}, original={orig}, minLength={minLength}",
        "String.MaxLength.Usr"              : "{context}: Invalid input - Maximum length is {maxLength}",
        "String.MaxLength.Log"              : "Invalid input - Too long: context={context}, input={input}, original={orig}, maxLength={maxLength}",

        // Error Messages for Exceptions
        "HTTPUtilities.Cookie.Protocol"     : "Cookies disallowed on non http[s] requests. Current protocol: {protocol}",
        "HTTPUtilities.Cookie.UnsafeData"   : "Attempt to add unsafe data to cookie (skip mode) - Cookie: {name}={value}",
        "HTTPUtilities.Cookie.CantKill"     : "Unable to kill cookie named {name}",
        "Cookie.Name"                       : "Cookie name \"{name}\" is a reserved token",
        "Cookie.Version"                    : "Cookie version \"{version}\" is not a valid version. Version must be 0 or 1."
    }
};/*
 * OWASP Enterprise Security API (ESAPI)
 *
 * This file is part of the Open Web Application Security Project (OWASP)
 * Enterprise Security API (ESAPI) project. For details, please see
 * <a href="http://www.owasp.org/index.php/ESAPI">http://www.owasp.org/index.php/ESAPI</a>.
 *
 * Copyright (c) 2008 - The OWASP Foundation
 *
 * The ESAPI is published by OWASP under the BSD license. You should read and accept the
 * LICENSE before you use, modify, and/or redistribute this software.
 */

$namespace('Base.esapi.properties');

Base.esapi.properties = {
    application: {
        // Change this value to reflect your application, or override it in an application scoped configuration.
        Name: 'ESAPI4JS Base Application'
    },

    httputilities: {
        cookies: {
            ForceSecure: true
        }
    },

    logging: {
        Implementation: org.owasp.esapi.reference.logging.Log4JSLogFactory,
        Level: org.owasp.esapi.Logger.ERROR,
        // For a console that pops up in a seperate window
        // Appenders: [ new ConsoleAppender(true) ],
        // To log to a logging service on the server
        // Appenders: [ new AjaxAppender( '/log/' ) ],
        // Default to log nowhere
        Appenders: [  ],
        LogUrl: false,
        LogApplicationName: false,
        EncodingRequired: true
    },

    encoder: {
        Implementation: org.owasp.esapi.reference.encoding.DefaultEncoder,
        AllowMultipleEncoding: false
    },

    localization: {
        StandardResourceBundle: ESAPI_Standard_en_US,
        DefaultLocale: 'en-US'
    },

    validation: {
        Implementation: org.owasp.esapi.reference.validation.DefaultValidator,
        AccountName: '^[a-zA-Z0-9]{3,20}$',
        SafeString: '[a-zA-Z0-9\\-_+]*',
        Email: '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\\.[a-zA-Z]{2,4}$',
        IPAddress: '^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$',
        URL: '^(ht|f)tp(s?)\\:\\/\\/[0-9a-zA-Z]([-.\\w]*[0-9a-zA-Z])*(:(0-9)*)*(\\/?)([a-zA-Z0-9\\-\\.\\?\\,\\:\\\'\\/\\\\\\+=&amp;%\\$#_]*)?$',
        CreditCard: '^(\\d{4}[- ]?){3}\\d{4}$',
        SSN: '^(?!000)([0-6]\\d{2}|7([0-6]\\d|7[012]))([ -]?)(?!00)\\d\\d\\3(?!0000)\\d{4}$',
        HttpScheme: '^(http|https)$',
        HttpServerName: '^[a-zA-Z0-9_.\\-]*$',
        HttpParameterName: '^[a-zA-Z0-9_]{1,32}$',
        HttpParameterValue: '^[a-zA-Z0-9.\\-\\/+=_ ]*$',
        HttpCookieName: '^[a-zA-Z0-9\\-_]{1,32}$',
        HttpCookieValue: '^[a-zA-Z0-9\\-\\/+=_ ]*$'
    }
};var BrowserSpecific =
{
  registerListeners: function()
  {
    if( Prototype.Browser.IE )
    {
      var inputs = $A(document.getElementsByTagName('input'));
       //Enter key submit handling added only for IE browser.
      if( inputs )
      {
        inputs.each(
                      function( input )
                      {
                        if(input.type === 'text' && !page.util.hasClassName(input,'noFormSubmitIE'))
                        {
                          Event.observe( input, "keypress",
                                         this.checkEnterKeyToSubmit.bindAsEventListener( this, input )
                                        );
                        }
                      }.bind( this )
                   );
      }
   }
 },
 checkEnterKeyToSubmit: function(event, input)
 {
   //if generated character code is equal to ascii 13 (if enter key)
   if(event.keyCode == 13 && input.form)
   {
     var submitButtons = $(input.form).getInputs('submit');
     if(submitButtons && submitButtons.size() > 0)
     {
       submitButtons.first().click();
     }
     Event.stop(event);
   }
   else
   {
     return true;
   }
 },
 // Fix FireFox bug which converts absolute links pasted into a VTBE into relative ones which
 // start with a variable number of "../".
 // https://bugzilla.mozilla.org/show_bug.cgi?id=613517
 handleFirefoxPastedLinksBug: function( baseUrl, vtbeText )
 {
   if ( !baseUrl || !vtbeText )
   {
     return vtbeText;	
   }

   if ( Prototype.Browser.Gecko )
   {
     if( !$( baseUrl.empty() ) && !$( vtbeText.empty() ) )
     {
       //e.g. extract out "http://localhost:80" from "http://localhost:80/webapps/Bb-wiki-BBLEARN/"
       // port is optional
       var absoluteUrlPrefix = baseUrl.match(/https?:[\d]*\/\/[^\/]+/);
       // e.g."../../../bbcswebdav/xid-2202_1" into "http://localhost:80/bbcswebdav/xid-2202_1"
       vtbeText = vtbeText.replace(/(\.\.\/)+(sessions|bbcswebdav|courses|@@)/g, absoluteUrlPrefix + "/" + "$2");
     }
   }
   return vtbeText;
 },

  disableEnterKeyInTextBoxes: function (document)
  {
    var inputs = $A(document.getElementsByTagName('input'));
    if( inputs )
    {
      inputs.each
      (
        function( input )
        { //must add special className for IE textboxes
          if( Prototype.Browser.IE )
          {
            input.addClassName( 'noFormSubmitIE' );
          }
          Event.observe( input, 'keypress', this.disableEnterKey );
        }.bind( this )
      );
    }
  },

  disableEnterKey: function( event )
  {
    if( event.keyCode != Event.KEY_RETURN )
    {
      return;
    }
    Event.stop( event );
    return;
  }
};
if ( !window.VideoIntegration )
{
  var VideoIntegration =
  {};

  VideoIntegration.TRUSTY_IFRAME_SOURCE_URL_ORIGIN = "";
  VideoIntegration.shouldSyncAltToTitle = true;

  VideoIntegration.onReceivingMessageHandler = function( event )
  {
    var messageType = event.data.messageType;
    var eventOrigin = event.origin;
    var eventSource = event.source;
    if ( messageType )
    {
      if ( VideoIntegration.TRUSTY_IFRAME_SOURCE_URL_ORIGIN &&
           eventOrigin === VideoIntegration.TRUSTY_IFRAME_SOURCE_URL_ORIGIN )
      {
        /*
         * For now we merely ack, which is expected by the Collab capture app, for most of the messages. In the future,
         * we may actually want to do more with the messages.
         */
        switch ( messageType )
        {
          case 'capture_loaded':
            eventSource.postMessage(
            {
              messageType : 'capture_loaded_ack'
            }, eventOrigin );
            break;
          case 'capture_maximize':
            eventSource.postMessage(
            {
              messageType : 'capture_maximize_ack'
            }, eventOrigin );
            break;
          case 'capture_complete':
            // save video uuid
            $('videoJSONId').value = event.data.uid;
            // display recording, title, alternative text
            $('videoInfoId').show();
            // update duration
            VideoIntegration.updateDuration( event.data.durationSeconds );
            // set focus on title
            $('videoTitleId').focus();
            // hide collab capture iframe
            $('collabCaptureId').hide();
            // add event listeners
            Event.observe('insertLinkId', 'click', VideoIntegration.onInsertLinkHandler);
            Event.observe('videoTitleId', 'input', VideoIntegration.onTitleChangeHandler);
            $j( "#altTextId" ).keydown(function() {
              if ( VideoIntegration.shouldSyncAltToTitle )
              {
                VideoIntegration.shouldSyncAltToTitle = false;
              }
            });
            break;
          case 'capture_close':
            eventSource.postMessage(
            {
              messageType : 'capture_close_ack'
            }, eventOrigin );
            break;
          default:
        }
      }
      else if ( eventOrigin === window.location.origin )
      {
        if ( messageType === 'iframe_origin' )
        {
          var iFrameURLOrigin = event.data.iFrameURLOrigin;
          if ( iFrameURLOrigin )
          {
            VideoIntegration.TRUSTY_IFRAME_SOURCE_URL_ORIGIN = iFrameURLOrigin;
          }
        }
      }
    }
  };
  
  VideoIntegration.updateDuration = function( durationSeconds )
  {
    var date = new Date( null );
    date.setSeconds( durationSeconds );
    var dateStr = date.toISOString();
    // the date format is 'hh:mm:ss'
    
    // hours are not supported for now
    var hourStr = dateStr.substr(11, 2);
    var hours = parseInt( hourStr, 10 );
    
    // minutes
    var minuteStr = dateStr.substr(14, 2);
    var minutes = parseInt( minuteStr, 10 );
    $('minuteId').update( minuteStr );
    if ( minutes > 1 )
    {
      $('minuteUnit').remove();
    }
    else
    {
      $('minutesUnit').remove();
    }
    
    // seconds
    var secondStr = dateStr.substr(17, 2);
    var seconds = parseInt( secondStr, 10 );
    $('secondId').update( secondStr );
    if ( seconds > 1 )
    {
      $('secondUnit').remove();
    }
    else
    {
      $('secondsUnit').remove();
    }
  };
  
  VideoIntegration.validateRecordingNameAndAltText = function()
  {
    var receipt = $('receipt_id');
    if ( receipt )
    {
      //Remove any existing inline receipt (if any).
      receipt.remove();
    }
    var videoTitle = $('videoTitleId').value.strip();
    var altText = $('altTextId').value.strip();
    if ( !videoTitle )
    {
      new page.InlineConfirmation( "error", page.bundle.getString( 'video-integration.empty.name.error' ), false );
      return false;
    }
    else if ( !altText )
    {
      new page.InlineConfirmation( "error", page.bundle.getString( 'video-integration.empty.altText.error' ), false );
      return false;
    }
    else
    {
      return true;
    }
  };
  
  VideoIntegration.onInsertLinkHandler = function()
  {
    if ( !VideoIntegration.validateRecordingNameAndAltText() )
    {
      return;
    }
    // Make REST API call to LEARN to save video integration.
    var videoJSON = JSON.stringify( { "videoUuid" : $('videoJSONId').value, 
      "videoTitle" : $('videoTitleId').value, "videoAltText": $('altTextId').value } );
    $j.ajax({
      type: "POST",
      url: "/learn/api/v1/video-integration",
      headers: { 'X-Blackboard-XSRF': $( 'ajaxNonceId' ).value },
      contentType: "application/json",
      data: videoJSON,
      success: function (data, status, jqXHR) 
      {
        // All the messages are dispatched only after all pending executions within the context of this function have finished.
        // So although the first message closes this dialog first, the message to insertHtmlAndCloseAddContentDialog
        // will also be dispatched before this window will be closed.

        var htmlToInsert = data.videoEmbeddedLink + '"' + $('videoTitleId').value.strip().escapeHTML() + '"';
        // Close this dialog. Needs to be closed using an async message so that the message to insert html can also be
        // dispatched before the dialog closes.
        parent.postMessage( {
          mceAction: 'closeContentSelectorDialog'
        }, origin );
        // Insert Html to the editor while showing a blocking animation on the Add Content Dialog, then close the dialog.
        parent.postMessage( {
          mceAction: 'insertHtmlAndCloseAddContentDialog',
          data: htmlToInsert
        }, origin );
      },
      error: function (jqXHR, status) 
      {
        new page.InlineConfirmation( "error", page.bundle.getString( 'video-integration.save.recording.failure.receipt' ) , false );
      },
      dataType: 'json'
    });
  };	
  
  VideoIntegration.onTitleChangeHandler = function()
  {
    $('videoNameId').update( $('videoTitleId').value.strip().escapeHTML() );
    if ( VideoIntegration.shouldSyncAltToTitle )
    {
      $('altTextId').value = $('videoTitleId').value;
    }
  };
  
  /**
   * Shows an inline receipt informing the user to not navigate away during the recording process.
   */
  VideoIntegration.showDoNotCloseRecordingWindowMsg = function()
  {
    new page.InlineConfirmation( "success", page.bundle.getString( 'video-integration.do-not-navigate-during-recording' ) , false );
  };
  
  /**
   * Setup communication between the window popup and collab capture.
   */
  VideoIntegration.initCollabCaptureCommunication = function( targetUrl )
  {
    window.addEventListener( "message", VideoIntegration.onReceivingMessageHandler, true );
    var iFrame = $("collabVideoIFrameId");
    iFrame.src = targetUrl;
    var iFrameURL = new URL( iFrame.src );
    window.postMessage(
    {
      messageType : 'iframe_origin',
      iFrameURLOrigin : iFrameURL.origin
    }, window.location.origin );
  };
  
  /**
   * Opens a popup window containing an iFrame displaying the specified video.
   */
  VideoIntegration.viewInPopup = function( courseId, videoUuid )
  {
	var queryParams = { course_id: courseId, videoUuid: videoUuid };
	var viewViewUrl = '/webapps/videointegration/view/play?' + jQuery.param( queryParams );
    var viewWindow = window.open( viewViewUrl, 'VideoIntegrationVideoView', 'height=715,width=1200,status=1,scrollbars=1,resizable=1' );
    if ( viewWindow )
    {
      viewWindow.focus();
    }
    return false;
  };
}
if ( !window.AllyIntegration )
{
  var AllyIntegration =
  {};

  AllyIntegration.initJWT = function( jwt )
  {
    window.ALLY_TOKEN = jwt;
  };

  AllyIntegration.initAllyJSConfigs = function( baseUrl, clientId )
  {
    window.ALLY_CFG =
    {
        'baseUrl' : baseUrl,
        'clientId' : clientId
    };
  };
}
if(!window.lightbox)
{
/**
 * lightbox.js - a flexible lightbox widget.
 * @author jriecken
 **/
var lightbox = {
  Lightbox: Class.create({
   /**
    * Creates a new lightbox.  If no "openLink" property exists in the config passed in,
    * the lb can be programmatically opened by calling open() on it.
    * @param cfg configuration for the lb.
    *  - lightboxId - The optional id to be set to the lightbox wrapping div. The default is no id attribute set on the lightbox wrapper element.
    *  - openLink - If passed will wire lb opening to this link, and set the focus back on it on close
    *  - focusOnClose - element that will receive the focus on close. If specified, it supercedes openLink element.
    *  - ajax - Whether to asyncronously load the lb content. This can be a simple boolean (the url will be taken from openLink's href) or a {url: 'url', params: 'params', loadExternalScripts: 'true'} object.
    *  --    if ajax{...loadExternalScripts :true} is defined then all all of the referenced script source files will be loaded before executing the scripts in the loaded page.
    *  - dimensions - A {w: xxx, h: xxx} object defining the dimensions of the lb.  If not passed, the lb will size to fit the content.
    *  - contents - Contents of the lb (not needed if async) - either a string, a function that returns a string, or an object with add'l config (see _updateLightboxContent).
    *  - title - Title for the lb.  If not passed and openLink is provided and has a title attribute, that attribute will be used.
    *  - defaultDimensions - Default dimensions for ajax loading phase of a lb that doesn't specify a dimensions config param.
    *  - fixedDimensions - Allows you to fix a certain dimension, while allowing the other dimension to autosize.
    *  - useDefaultDimensionsAsMinimumSize - if useDefaultDimensionsAsMinimumSize set then increase size to be the minimum if the auto-size results in a small size
    *  - horizontalBorder - specifies the minimum dimension for the width around the lightbox, default is set to 50
    *  - verticalBorder - specifies the minimum dimension for the height around the lightbox, default is set to 50
    *  - constrainToWindow - Whether to ensure that the lb will fit inside the window.
    *  - closeOnBodyClick - Whether to close the lb when the user clicks outside of the lb.
    *  - processingTemplate - HTML template for the content shown while an async load is in progress.
    *  - lbTemplate - HTML template for the lb. If user-supplied lbTemplate & title parameters are passed to the lightbox, the lbTemplate must contain any required  headings for the title.
    *  - lbContentClass - div class that contains the lb content, useful with client-supplied lbTemplate.
    *  - troubleElems - Elements that should be hidden while the lb is open.
    *  - msgs - I18N messages used by the lb.
    *  - onClose - call back function that if passed is called when the light box is closed
    *  - left - optional left position for lb. Default position is centered
    *  - top - optional top position for lb. Default position is centered
    *  - setPositionAbsolute - sets the position to absolute (instead of fixed) by applying the appropriate css class (useful for small device widths)
    **/
   initialize: function( cfg )
   {
     //Default values for configuration parameters.
     this.cfg = Object.extend({
        lightboxId: "",
        openLink: null,
        ajax: null,
        dimensions: null,
        contents: "",
        title: "",
        focusOnClose: "",
        defaultDimensions: { w: 320, h: 240 },
        fixedDimensions: null,
        useDefaultDimensionsAsMinimumSize : false,
        horizontalBorder : 50,
        verticalBorder : 50,
        constrainToWindow: true,
        closeOnBodyClick: true,
        showCloseLink: true,
        processingTemplate: '<div class="lb-loading" style="width: #{width}px; height: #{height}px;"><span class="hideoff">#{loadingText}</span></div>',
        lbTemplate: '<div class="lb-header" tabindex="-1">#{title}</div><div class="lb-content" aria-live="off"></div><a class="lbAction u_floatThis-right" href="\\#close" title=\'#{closeText}\' role="button"><img src="' + getCdnURL( "/images/ci/mybb/x_btn.png" ) + '" alt="#{closeText}"></a>',
        lbContentClass: 'lb-content',
        troubleElems: [ 'select', 'object', 'embed', 'applet' ],
        msgs: { 'close' : page.bundle.getString('inlineconfirmation.close'), 'loading' : page.bundle.getString('lightbox.loading') }
     }, cfg);
     if ( !this.cfg.showCloseLink && !cfg.lbTemplate )
     {
       this.cfg.lbTemplate = '<div class="lb-header" tabindex="-1">#{title}</div><div class="lb-content" aria-live="off"></div><span tabindex="0" class="lb-focustrap"> </span>';
     }
     this.cfg.title = this.cfg.title || ( this.cfg.openLink && this.cfg.openLink.title ? this.cfg.openLink.title : "" );
     var lbWrapper =  new Element( 'div' ).addClassName( 'lb-wrapper' );
     lbWrapper.setAttribute( "role", "dialog" );
     var wrapperArgs = {
       title: this.cfg.title,
       closeText: this.cfg.msgs.close,
       lbContentClass: this.cfg.lbContentClass
     };
     if ( wrapperArgs.title )
     {
       if ( !cfg.lbTemplate )
       {
         wrapperArgs.title = '<h2 id="dialogheading">' + wrapperArgs.title + '</h2>';
         lbWrapper.setAttribute( "aria-labelledby", "dialogheading" );
       }
     }
     else
     {
       wrapperArgs.title = '&nbsp;';
     }

     if ( this.cfg.openLink )
     {
       this.cfg.openLink = $( this.cfg.openLink );
       this.cfg.openLink.observe( 'click', this._onOpen.bindAsEventListener( this ) );
       if ( !this.cfg.focusOnClose )
       {
         this.cfg.focusOnClose = this.cfg.openLink;
       }
     }
     this.overlay = new Element('div').addClassName('lb-overlay').setStyle( { opacity: 0 } );
     this.lightboxWrapper = lbWrapper.update( this.cfg.lbTemplate.interpolate( wrapperArgs ) );
     if( this.cfg.setPositionAbsolute )
     {
       this.lightboxWrapper.addClassName('lb-wrapper-absolute');
     }
     if ( this.cfg.lightboxId )
     {
       this.lightboxWrapper.setAttribute( 'id', this.cfg.lightboxId );
     }

     var header = this.lightboxWrapper.down('.lb-header');
     if ( header )
     {
       this.lightboxTitle = header.down('h2');
     }

     this.lightboxContent = this.lightboxWrapper.down('div.' + this.cfg.lbContentClass);
     this.firstLink = this.lightboxWrapper.down('.lb-header');
     if ( this.cfg.showCloseLink )
     {
       this.closeLink = this.lastLink = this.lightboxWrapper.down('.lbAction');
       this.closeLink.observe( 'click', this._onClose.bindAsEventListener( this ) );
     }
     else
     {
       this.lastLink = this.lightboxWrapper.down('.lb-focustrap');
       if ( !this.lastLink )
       {
         this.lastLink = this.firstLink;
       }
     }
     //Wire up events
     this.lightboxWrapper.observe( 'keydown', this._onKeyPress.bindAsEventListener( this ) );
     if ( this.cfg.closeOnBodyClick )
     {
       this.overlay.observe( 'click', this._onOverlayClick.bindAsEventListener( this ) );
     }
     this.boundResizeListener = this._onWindowResize.bindAsEventListener( this );
   },
   /**
    * Opens the lightbox.
    * @param afterOpen a callback function to call after the lb has finished loading.
    */
   open: function( afterOpen )
   {
     lightbox.closeCurrentLightbox();
     lightbox._currentLightbox = this;
     this._fixIE( true );
     this._toggleTroubleElements( true );

     document.body.appendChild( this.overlay );
     new Effect.Opacity( this.overlay, {
       from: 0.0, to: 0.5, duration: 0,  // duration must be 0 to avoid focus problem with IE & screen reader
       afterFinish: function()
       {
         document.body.appendChild( this.lightboxWrapper );
         this._updateLightboxContent( afterOpen );
         //Calling the youtube API Method when the light box is loaded
         var lbc1 = this.lightboxContent;
         var frameIds = lbc1.getElementsByClassName("ytIframeClass");
         if ( frameIds.length > 0 ) {
           var frameIdss = [];
           frameIdss.push( frameIds[0] );
           
         }
         Event.observe( window, 'resize', this.boundResizeListener );
       }.bind( this ) });
   },
   /**
    * Shows the existing the lightbox. The content will not be updated, it is up to the caller to update the content
    *
    * @param afterOpen a callback function to call after the lb has finished loading.
    */
   show: function( afterOpen )
   {
     //If the lightboxWrapper is null, open the light box.
     if ( !this.lightboxWrapper )
     {
       open( afterOpen );
       return;
     }

     lightbox._currentLightbox = this;
     document.body.appendChild( this.overlay );
     new Effect.Opacity( this.overlay, {
       from: 0.0, to: 0.5, duration: 0,  // duration must be 0 to avoid focus problem with IE & screen reader
       afterFinish: function()
       {
         this.lightboxWrapper.removeClassName("hideme");
         Event.observe( window, 'resize', this.boundResizeListener );
         window.dispatchEvent(new Event('resize'));
       }.bind( this ) });
   },

   /**
    * Closes the lightbox.
    */
   close: function(hide)
   {
      if ( /MSIE (\d+\.\d+);/.test( navigator.userAgent ) && this._ytPlayers )
      {
        // This gives the list of all the ytplayers in the page.. need to find the correct one.
        for ( var i = this._ytPlayers.length - 1; i >= 0; i-- )
        {
          var currentPlayer = this._ytPlayers[ i ];
          var lightboxDiv = page.util.upToClass( currentPlayer.getIframe(), "lb-content" );
          if ( lightboxDiv )
          {
            if ( currentPlayer.stopVideo )
            {
              currentPlayer.stopVideo();
            }
            
            var iframe = currentPlayer.getIframe();
            iframe.style.display = 'none';
            iframe.src = "";

            if ( currentPlayer.clearVideo )
            {
              currentPlayer.clearVideo();
            }
            
            break;
          }
        }
      }

     this._hideLightBox = hide;
     if (this.cfg.onClose) {
       if ( Object.isFunction( this.cfg.onClose ) )
       {
         this.cfg.onClose();
       }
       else
       {
         var closeFunc = new Function(this.cfg.onClose);
         closeFunc();
       }
    }
     Event.stopObserving( window, 'resize', this.boundResizeListener );
     if ( this.movedElement && this.originalParent )
     {
       this.movedElement.parentNode.removeChild( this.movedElement );
       this.originalParent.appendChild( this.movedElement );
       this.movedElement.style.display = this.movedElement.originalDisplay;
     }

     if ( !this._hideLightBox )
     {
       this._clearLightboxContent();
       this.lightboxWrapper.remove();
     }
     else
     {
       this.lightboxWrapper.addClassName("hideme");
     }

     new Effect.Opacity( this.overlay, {
      from: 0.3, to: 0.0, duration: 0, // duration must be 0 to avoid focus problem with IE & screen reader
      afterFinish: function()
      {
         this.overlay.remove();
         this._toggleTroubleElements( false );
         this._fixIE( false );
         if ( !this._hideLightBox )
         {
          lightbox._currentLightbox = null;
         }
         if ( this.cfg.focusOnClose ) { $(this.cfg.focusOnClose).focus(); }
      }.bind( this ) });
   },
   /**
    * Hide the lightbox.
    */
   hide: function()
   {
     this.close(true);
   },
   resize: function( newDimensions )
   {
     this.cfg.dimensions = newDimensions; // might be null, in which case it is auto-resize
     this._resizeAndCenterLightbox( );
   },


   /** Event listener for opening lb. */
   _onOpen: function( event ) { this.open(); event.stop(); },
   /** Event listener for closing lb. */
   _onClose: function( event ) { this.close(); event.stop(); },
   /** Event listener wired when closeOnBodyClick is true. */
   _onOverlayClick: function( event ) { if ( event.element() == this.overlay ) { this.close(); } event.stop(); },
   /** Event listener for keyboard presses in the LB. */
   _onKeyPress: function( event )
   {
     var key = event.keyCode || event.which;
     var elem = event.element();
     // Close on ESC type
     if ( key == Event.KEY_ESC )
     {
       this.close();
       event.stop();
     }
     // Set up the tab loop (don't tab/shift-tab out of the lb)
     else if ( key == Event.KEY_TAB && !event.shiftKey && elem == this.lastLink )
     {
       this.firstLink.focus();
       event.stop();
     }
     else if ( key == Event.KEY_TAB && event.shiftKey && elem == this.firstLink )
     {
       this.lastLink.focus();
       event.stop();
     }

   },
   /** Event listener for window resize. */
   _onWindowResize: function( event )
   {
     this._resizeAndCenterLightbox( false );
   },
   /**
    * Clears the lightbox.
    */
   _clearLightboxContent: function()
   {
     this.lightboxContent.update( '' );
   },
   /**
    * Updates the lightbox content based on the configuration.
    * @param afterFinish a callback to call after the content has finished updating.
    */
   _updateLightboxContent: function( afterFinish )
   {
     if ( this.cfg.ajax ) //Async
     {
       this._resizeAndCenterLightbox( true );
       var lbc = this.lightboxContent;
       var lbcDim = lbc.getDimensions();
       lbc.update(
         this.cfg.processingTemplate.interpolate(
         {
           loadingText: this.cfg.msgs.loading,
           width: (lbcDim.width - this._extraWidth( lbc, false ) ),
           height: (lbcDim.height - this._extraHeight( lbc, false, true ) )
         } )
       ).setStyle({
           overflow: 'hidden'
       }).focus();

       var url = this.cfg.ajax.url || this.cfg.openLink.href;
       var params = this.cfg.ajax.params || {};
       var requestMethod = this.cfg.ajax.method || 'get';
       var requestHeaders = this.cfg.ajax.requestHeaders || {};
       var asynFlag = this.cfg.ajax.asyn == null || this.cfg.ajax.asyn
       var cb = function( response )
       {
         lbc.setStyle({ overflow: 'auto' });
         this._updateLightboxContentHelper( response.responseText, afterFinish );
       }.bind( this );
       new Ajax.Request( url, {
        method: requestMethod ,
        asynchronous : asynFlag,
        parameters: params,
        requestHeaders: requestHeaders,
        onSuccess: cb,
        onFailure: cb
       });
     }
     else //Static
     {
       var c = this.cfg.contents; //Normal string contents
       if ( Object.isFunction( c ) ) //Function to get contents
       {
         c = c( this );
       }
       else if ( !Object.isString( c ) && !(Object.isArray( c ) ) ) //Config object
       {
         if ( c.id ) //Load contents from an element on the page already
         {
           var elem = $( c.id );

           //Lightbox can contain the elements that are considered to be 'trouble elements'.
           //Loop through to make sure that they are visible in the lightbox.
           this._toggleTroubleElementsHelper( elem, false );

           if ( c.move )
           {
             c = elem;
           }
           else
           {
             if( c.stripComments !== undefined && c.stripComments )
             {
               c = elem.innerHTML.replace('<!--','').replace('-->','');
               c = this._recreateMashupsHtml( c  );
             }
             else
             {
               c = elem.innerHTML;
             }
           }
         }
         else if ( c.auto && this.cfg.openLink ) // Attempt to auto load the content from the link href based on the file extension
         {
           var h = this.cfg.openLink.href;
           if ( lightbox._imageTypeRE.test( h ) )
           {
             c = '<img src="' + h + '" style="vertical-align:top;display:block;" alt="'+ this.cfg.title+'">';
           }
           else
           {
             c = "";
           }
         }
       }
       this._updateLightboxContentHelper( c, afterFinish );
     }
   },
   /**
    * Helper that actually updates the contents of the lb.
    * @param content the HTML content for the lb.
    * @param afterFinish a callback that will be called when the update is done.
    */
   _updateLightboxContentHelper: function( content, afterFinish )
   {
     var lbc = this.lightboxContent;
     var element;

     if ( Object.isElement( content ) )
     {
       element = content;
       content = "<div id='lb-container' class='lb-container'></div>";
     }

     this.evaluatingScripts = false;
     if (this.cfg.ajax && this.cfg.ajax.loadExternalScripts )
     {
       // Make sure all global scripts are evaluated in the lightbox content:
       content = Object.toHTML(content);
       lbc.innerHTML = content.stripScripts();
       this.evaluatingScripts = true;
       page.globalEvalScripts( content, true, this);
     }
     else
     {
       lbc.update(content);
     }
    
     if ( element )
     {
       this.originalParent = element.parentNode;
       this.movedElement = element;
       $( 'lb-container').appendChild( element );
       this.movedElement.originalDisplay = this.movedElement.style.display;
       element.show();
     }
     this._resizeWhenImagesReady( afterFinish );
     if ( !this.firstLink )
     {
       this.firstLink = lbc.down('a');
     }
     if ( this.firstLink )
     {
       (function() { this.firstLink.focus(); }.bind(this).defer( 1 ));
     }
   },

   /**
    * Since images don't load immediately, we need to wait until they've
    * loaded before resizing
    */
   _resizeWhenImagesReady: function( afterFinish )
   {
     var lbw = this.lightboxWrapper, lbc = this.lightboxContent;
     var imgs = lbc.getElementsByTagName( 'img' );
     var iterations = 0;
     if (( !this.cfg.dimensions && imgs.length > 0 ) || (this.evaluatingScripts))
     {
       new PeriodicalExecuter( function( pe )
       {
         iterations++;
         var allDone = page.util.allImagesLoaded( imgs );
         if (this.evaluatingScripts)
         {
           allDone = false;
         }
         // Done, or waited more than 5 seconds
         if ( allDone || iterations > 50 )
         {
           //Show the lightbox
           lbw.show();
           lbc.focus();
           this._resizeAndCenterLightbox( false );
           if ( afterFinish ) { afterFinish(); }
           this._initializeBottomSubmitStep( lbc );
           pe.stop();
         }
       }.bind(this),0.1);
     }
     else
     {
       this._resizeAndCenterLightbox( false );
       if ( afterFinish ) { afterFinish(); }
       this._initializeBottomSubmitStep( lbc );
     }
   },

   /**
    * Invoke page.util.pinBottomSubmitStep if bottom submit button is found.
    * This method is called with the light box content has been fully loaded.
    */
   _initializeBottomSubmitStep: function( lbc )
   {
	 var bottomSubmitToBePinned = page.util.getBottomSubmitStep();
     if ( bottomSubmitToBePinned ){
         page.util.pinBottomSubmitStep( bottomSubmitToBePinned, lbc );
       }
   },

   /**
    * Size the lightbox and make sure that it is centered in the viewport.
    * @param isLoading whether we're in the async loading phase.
    */
   _resizeAndCenterLightbox: function( isLoading )
   {
     var lbw = this.lightboxWrapper,
         lbc = this.lightboxContent,
         lbt = this.lightboxTitle, title, lbDim;

     var viewDim = document.viewport.getDimensions();

     var maxWidth = viewDim.width - this.cfg.horizontalBorder,
         maxHeight = viewDim.height - this.cfg.verticalBorder;

     if ( lbt ) //Ensure a long title doesn't cause the lightbox to get very wide.
     {
       title = lbt.innerHTML;
       lbt.update( '' );
     }

     if ( this.cfg.dimensions ) // explicitly defined size
     {
       lbw.setStyle( { width: this.cfg.dimensions.w + 'px',  height: this.cfg.dimensions.h + 'px' } );
     }
     else if (isLoading) // temporary loading size
     {
       lbw.setStyle({ width: this.cfg.defaultDimensions.w + 'px', height: this.cfg.defaultDimensions.h + 'px'});
     }
     else // auto-size
     {
      var fixedWidth = '', fixedHeight = '';

      if (this.cfg.fixedDimensions && this.cfg.fixedDimensions.w) {
        fixedWidth = (this.cfg.constrainToWindow ? Math.min(this.cfg.fixedDimensions.w, maxWidth) : this.cfg.fixedDimensions.w) + 'px';
      }

      if (this.cfg.fixedDimensions && this.cfg.fixedDimensions.h) {
        fixedHeight = (this.cfg.constrainToWindow ? Math.min(this.cfg.fixedDimensions.h, maxHeight) : this.cfg.fixedDimensions.h) + 'px';
      }

      lbw.setStyle( { width: fixedWidth,  height: fixedHeight } );
      lbc.setStyle( { height: '' } );
      lbDim = lbw.getDimensions();
      lbDim.width = lbDim.width - this._extraWidth( lbw, false);
      lbDim.height = lbDim.height - this._extraHeight( lbw, false, true);
      if ( this.cfg.useDefaultDimensionsAsMinimumSize )
      {
        // resize width and height to the minimum set
        if ( lbDim.width < this.cfg.defaultDimensions.w )
        {
          lbDim.width = this.cfg.defaultDimensions.w;
        }
        if( lbDim.height <  this.cfg.defaultDimensions.h )
        {
           lbDim.height =  this.cfg.defaultDimensions.h;
        }
      }
       lbw.setStyle( { width: ( lbDim.width ) + 'px',  height: ( lbDim.height ) + 'px' } );
     }
     lbDim = lbw.getDimensions();
     if ( this.cfg.constrainToWindow )
     {
       if ( lbDim.width > ( maxWidth ) )
       {
         lbw.setStyle( { width: ( maxWidth ) + 'px' } );
       }
       if ( lbDim.height > ( maxHeight ) )
       {
         lbw.setStyle( { height: ( maxHeight ) + 'px' } );
       }
       lbDim = lbw.getDimensions();
     }
     var l = parseInt( ( viewDim.width / 2.0 ) - (lbDim.width / 2.0 ) , 10 );
     var t = parseInt( ( viewDim.height / 2.0 ) - (lbDim.height / 2.0 ) , 10 );
     if (this.cfg.top){
       t = this.cfg.top;
     }
     if (this.cfg.left){
       l = this.cfg.left;
     }
     lbw.setStyle({ left: l + "px", top: t + "px" });
     var h = ( lbDim.height - this._extraHeight( lbw, false, false ) - this._extraHeight( lbc, true, true ) - lbc.positionedOffset().top );
     if (h >= 0)
     {
       lbc.setStyle({ height: h + "px"});
     }

     if ( lbt )
     {
       lbt.update( title );
     }
   },
   /**
    * Calculate the extra height added by padding and border.
    * @param element DOM elem to calculate the extra height for.
    * @param mBot whether to include the bottom margin
    * @param pTop whether to include the top padding.
    */
   _extraHeight: function( element, mBot, pTop )
   {
     var r = 0, dims = ['paddingBottom','borderTopWidth','borderBottomWidth'].concat(
       mBot ? ['marginBottom'] : [] ).concat(
       pTop ? ['paddingTop'] : [] );
     dims.each( function( d ) { r += parseFloat( element.getStyle( d ) ) || 0; });
     return r;
   },
   /**
    * Calculate the extra width added by padding, border, (optionally margin)
    * @param element DOM elem to calculate the extra width for.
    * @param m whether to include margins
    */
   _extraWidth: function( element, m )
   {
     var r = 0, dims = ['paddingLeft','paddingRight','borderLeftWidth','borderRightWidth'].concat(
       m ? ['marginLeft','marginRight'] : [] );
     dims.each( function( d ) { r += parseFloat( element.getStyle( d ) ) || 0; });
     return r;
   },
   /**
    * Regrettably, some JavaScript hacks are necessary for IE 6
    * @param on whether to turn the hacks on or off
    */
   _fixIE: function( on )
   {
     if ( /MSIE 6/i.test(navigator.userAgent) )
     {
       var body = document.getElementsByTagName('body')[0];
       var html = document.getElementsByTagName('html')[0];
       if ( on )
       {
         this.currentScroll = document.viewport.getScrollOffsets();
         window.scrollTo( 0, 0 );
       }
       Element.setStyle( body, ( on ? { height: '100%', overflow: 'hidden' } : { height: '', overflow: '' } ) );
       Element.setStyle( html, ( on ? { height: '100%', overflow: 'hidden' } : { height: '', overflow: '' } ) );
       this.overlay.setStyle( ( on ? { width: "120%", height: "100%"} : { width: "", height: ""} ));
       if ( !on )
       {
         window.scrollTo( this.currentScroll.left, this.currentScroll.top );
       }
     }
   },

   _toggleTroubleElementsHelper : function( contentElem, turnOff )
   {
     this.cfg.troubleElems.each( function(elemType) {

       var elems;
       if ( contentElem === null )
       {
         elems = document.getElementsByTagName( elemType );
       }
       else
       {
         elems = contentElem.getElementsByTagName( elemType );
       }

       var numElems = elems.length;
       for ( var i = 0; i < numElems; i++ )
       {
         try
         {
           elems[i].style.visibility = (turnOff ? 'hidden' : '');
         }
         catch ( e )
         {
           // Setting visibility blows up on Linux Chrome; just ignore this error, as the only
           // real consequence will be some potential UI artifacts
         }
       }
     }.bind( this ) );
   },

   /**
    * Toggle elements that may bleed through the lightbox overlay.
    * @param turnOff whether to turn off the elements.
    */
   _toggleTroubleElements: function( turnOff )
   {
     this._toggleTroubleElementsHelper( document, turnOff );
   },
   
   /**
    * Mashups could contain malicious data entered by users. 
    * So extract the required information and recreate mashup HTML to display in lightbox.
    * @param oldContent current HTML data for mashup.
    */
   _recreateMashupsHtml: function( oldContent )
   {
     var mashupType = this._checkMashupType( oldContent );
     var isLegacy = this._checkMashupIslegacy( oldContent, mashupType );
     var returnStr = '<div style=\"margin: 10px;\">' + page.bundle.getString( 'mashups.content.data.msg' ) + '</div>';
     
     if( mashupType === "youtube" )
     {
       return this._recreateYoutubeHtml( oldContent, isLegacy );
     }
     else if( mashupType === "slideshare" )
     {
       return this._recreateSlideshareHtml( oldContent, isLegacy );
     }
     else if( mashupType === "flickr" )
     {
       return this._recreateFlickrHtml( oldContent );
     }
     else
     {
       MashupDWRFacade.filterMashupData( oldContent, {
         async : false,
         callback : function( filteredData )
           {
             returnStr =  filteredData;
           }
         } );
     }
     
     return returnStr ;
   },
   
   _checkMashupType: function( oldContent )
   {
     var mashupType = "";
     if( ( oldContent.indexOf("openYtControls") !== -1 ) || ( oldContent.indexOf("//www.youtube.com/") !== -1 ) )
     {
       mashupType = "youtube";
     }
     else if( (oldContent.indexOf("slidesharecdn") !== -1) || (oldContent.indexOf("www.slideshare.net/slideshow") !== -1) )
     {
       mashupType = "slideshare";
     }
     else if( oldContent.indexOf("flickr") !== -1 )
     {
       mashupType = "flickr";
     }
     return mashupType;
   },
   
   _checkMashupIslegacy: function( oldContent, mashupType )
   {
     var isLegacy = false;
     if( (mashupType === "youtube" || mashupType === "slideshare" ) && oldContent.indexOf("<object") != -1 )
     {
       isLegacy = true;
     }
     else if(  (mashupType === "flickr" ) && oldContent.indexOf("<img") != -1 )
     {
       isLegacy = true;
     }
     return isLegacy;
   },

   _recreateYoutubeHtml: function( oldContent, isLegacy )
   {
     var title = "";
     var videoId = "";
     var strYtUrl = "";
     var newHTML = "";
     var uniqueId = "";
      
     //valid youtube video id could contain a-z, A-Z, 0-9, "_" and "-" only.
     oldContent = oldContent.replace(/&#45;/g,'-');
     oldContent = oldContent.replace(/&#95;/g,'_');
     
     if( isLegacy )
     {
       videoId = oldContent.match("//www.youtube.com/v/([\\d\\w-_]+)")[1];
     }
     else
     {
       videoId = oldContent.match("//www.youtube.com/embed/([\\d\\w-_]+)")[1];
     }
     
     if( oldContent.indexOf("openYtControls") !== -1 )
     {
       uniqueId = oldContent.match("openYtControls([\\d\\w]+)")[1];
     }
     //to make sure video plays in popup preview
     strYtUrl = "https://www.youtube.com/embed/" + videoId + "?modestbranding=1&fs=1&rel=0&menu=disable&enablejsapi=1&playerapiid=ytEmbed" + uniqueId + "&wmode=transparent";

     title = $ESAPI.encoder().canonicalize( title );
     title = $ESAPI.encoder().encodeForHTMLAttribute( title );
     //regenerate HTML to display in lightbox.
     //yt video with player controls.
     if( uniqueId !== "" && strYtUrl !== "" )
     {
   
       
       newHTML = '<div style=\"margin: 10px;\"><div class=\"u_controlsWrapper\"></div>' +
       '<h2 class=\"hideoff\">' + page.bundle.getString( 'display.embeddedVideoPlayer' ) +': ' + title + '</h2>' +
       '<div style=\"word-wrap: break-word;\">';
      
       //create iframe tag
       newHTML += '<div class=\"previewDiv ytIframeClass\" style=\"height:344px;width:425px\"' + 
       ' id=\"ytEmbed' + uniqueId + '\">' + 
       '<iframe id=\"ytObject' + uniqueId + '\"' + ' width=\"425\" height=\"344\" src=\"' + strYtUrl + '\"' + 
       ' title=\"' + title + '\"' +  ' allowfullscreen></iframe>';

       newHTML += '<a href=\"#close\" onclick=\"lightbox.closeCurrentLightbox(); return false;\" class=\"hideoff\">' +
       page.bundle.getString( 'inlineconfirmation.close' ) + '</a></div>' + 
       '<div id=\"strip' +  uniqueId + '\" class=\"liveArea-slim playerControls\" style=\"display:none\">' +
       '<h2 class=\"hideoff\">' + page.bundle.getString( 'display.videoStatus' ) +': ' + title + '</h2>' +
       '<span aria-live=\"off\" id=\"currentStatus' +  uniqueId + '\"></span>' +
       '</div></div></div>';
     }
     //yt video without player controls.
     if( uniqueId === "" && strYtUrl !== "" )
     {
       newHTML = '<div class=\"previewDiv\" style=\"height:344px;width:425px\"' + 
       ' id=\"ytEmbed' + '\">' + 
       '<iframe id=\"ytObject' + '\"' + ' width=\"425\" height=\"344\" src=\"' + strYtUrl + '\"' + 
       ' title=\"' + title + '\"' +  '></iframe></div>';  
     }

     return newHTML;
   },
   convertTime : function (duration) {
	   var total = 0;
	   var hours = duration.match(/(\d+)H/);
	   var minutes = duration.match(/(\d+)M/);
	   var seconds = duration.match(/(\d+)S/);
	   if (hours) total += parseInt(hours[1]) * 3600;
	   if (minutes) total += parseInt(minutes[1]) * 60;
	   if (seconds) total += parseInt(seconds[1]);
	   return total;
	 },
   formatTime : function ( sec )
   {
     var duration = parseInt( sec, 10 );
     var totalMinutes = Math.floor( duration / 60 );
     var hours = Math.floor( totalMinutes / 60 );
     var seconds = duration % 60;
     var minutes = totalMinutes % 60;
     if ( hours > 0 )
     {
       return hours + ':' + this.padZero( minutes ) + ':' + this.padZero( seconds );
     }
     else
     {
       return this.padZero( minutes ) + ':' + this.padZero( seconds );
     }
   },
   padZero : function ( number )
   {
     if (number < 10)
     {
       return "0" + number;
     }
     else
     {
       return number;
     }
   },
   
   _recreateSlideshareHtml: function( oldContent, isLegacy )
   {
     var title = "";
     var slideShowId = "";
     var ssSearchKey = "";
     var authorName = "";
     var newHTML = "";
     if( isLegacy ) 
     {
       oldContent = oldContent.replace(/&#45;/g,'-');
       ssSearchKey = oldContent.match("id=[\"]__sse(\\d+)")[1];
     }
     else
     {
       // New Slideshare oEmbed documentation at http://www.slideshare.net/developers/oembed; oEmbed specs at http://www.oembed.com
       ssSearchKey = oldContent.match("<a[^>]*>((?:.|\r?\n)*?)<\/a>")[0];
       ssSearchKey = ssSearchKey.replace(/&#45;/g,'-');
       ssSearchKey = ssSearchKey.match( "href=\"(http|https):\/\/www.slideshare.net\/([A-Za-z0-9]|[-_~.*!()/&#;#%'?=@+$,])*\"" )[0];
       ssSearchKey = ssSearchKey.substring( 6, ssSearchKey.length - 1 );
     }
     
     //make a call to slide share server and get real data.
     var url =  "https://www.slideshare.net/api/oembed/2?url=https://www.slideshare.net/" + ssSearchKey + "&format=json";
     
     MashupDWRFacade.verifyMashupData( url, {
       async : false,
       callback : function( returnString )
         {
           if( returnString === "" )
           {
             newHTML = '<div style=\"margin: 10px;\">' + page.bundle.getString( 'mashups.content.data.msg' ) + '</div>' ;
           }
           else
           {
             var videoJSON = returnString.evalJSON( true );
             title = videoJSON.title;
             slideShowId = videoJSON.slideshow_id;
             authorName = videoJSON.author_name;
           }
         }
       } );
     title = $ESAPI.encoder().canonicalize( title );
     title = $ESAPI.encoder().encodeForHTMLAttribute( title );
     slideShowId = $ESAPI.encoder().canonicalize( slideShowId + "" );
     slideShowId = $ESAPI.encoder().encodeForHTMLAttribute( slideShowId + "" );
     authorName = $ESAPI.encoder().canonicalize( authorName );
     authorName = $ESAPI.encoder().encodeForHTMLAttribute( authorName );
     if( slideShowId !== '' )
     {
       //create iframe tag
       return '<iframe src=\"https://www.slideshare.net/slideshow/embed_code/' + slideShowId + '\" ' +
       ' width=\"427\" height=\"356\" frameborder=\"0\" marginwidth=\"0\" marginheight=\"0\"  scrolling=\"no\" ' +
       ' style=\"border:1px solid #CCC;border-width:1px 1px 0;margin-bottom:5px\"  allowfullscreen></iframe>' +
       '<div style="margin-bottom:5px"><strong><a href=\"#\" title=\"' +
       title + '\">' + title + '</a></strong> <strong><a href=\"#\">' +
       authorName + '</a></strong>.</div>';
     }
     
     return newHTML ;
   },
   
   _recreateFlickrHtml: function( oldContent )
   {
     var flickrImgSrcUrl = "";
     var title = "";
     var flickrKey = "";
     var newHTML = "";

     flickrKey = oldContent.match("//www.flickr.com/photos/([\\d\\w@/]+)")[1];
     var flickrUrl = "https://www.flickr.com/services/oembed?url=http://flickr.com/photos/" + flickrKey + 
                     "&format=json&maxheight=640&maxwidth=640";
     
     MashupDWRFacade.verifyMashupData( flickrUrl, {
       async : false,
       callback : function( returnString )
         {
           if( returnString === "" )
           {
             newHTML = '<div style=\"margin: 10px;\">' + page.bundle.getString( 'mashups.content.data.msg' ) + '</div>' ;
           }
           else
           {
             var videoJSON = returnString.evalJSON( true );
             title = videoJSON.title;
             //sometimes http://flickr.com/services/oembed doesn't return url
             if ( videoJSON.url === null )
             {
               flickrImgSrcUrl = videoJSON.thumbnail_url;
             }
             else
             {
               flickrImgSrcUrl = videoJSON.url;
             }
           }
         }
       } );

     title = $ESAPI.encoder().canonicalize( title );
     title = $ESAPI.encoder().encodeForHTMLAttribute( title );
     if( flickrImgSrcUrl !== '' )
     {
       return '<div style=\"margin: 10px;\"><a href=\"http://flickr.com/photos/' + flickrKey + '\"' +
       '  target=\"_blank\" title=\"' + page.bundle.getString( 'display.view.on.flickr' ) + '\" />' +
       '<img src="' + flickrImgSrcUrl + '\"  alt=\"' + title + '\"></a></div>';
     }
     return newHTML ;
   }
  }),

  /* Static properties/methods */
  _imageTypeRE: /(\.bmp|\.gif|\.jpeg|\.jpg|\.png|\.tiff)$/i, /** Regex for sniffing image files */
  _currentLightbox: null, /** Currently open lightbox */
  /** Returns the currently open lightbox (null if no lightbox is open) */
  getCurrentLightbox: function()
  {
    return lightbox._currentLightbox;
  },
  // This is currently only called from page.js when the vtbe is toggled.  It is used
  // to reload the page and respect the new vtbe settings.
  // NOTE that there is a limitation of not allowing VTBEs both in-page and in-lightbox. If
  // we ever run into a situation where we have a vtbe on-page and then open a lightbox with
  // a VTBE in the lightbox then we'll have to enhance the vtbe infrastructure to deal with this properly.
  deferUpdateLightboxContent: function ( )
  {
    if (lightbox._currentLightbox && window.vtbeInLightbox)
    {
      vtbe_map = {}; // Turf all vtbe's
      (function() {
        lightbox._currentLightbox._updateLightboxContent();
      }).bind(this).delay(0.1);
      return true;
    }
    return false;
  },
  /**
   * Close the currently open lightbox (if any)
   */
  closeCurrentLightbox: function()
  {
    var lb = lightbox._currentLightbox;
    if ( lb )
    {
      lb.close();
    }
  },
  /**
   * Hide the currently open lightbox (if any)
   */
  hideCurrentLightbox: function()
  {
    var lb = lightbox._currentLightbox;
    if ( lb )
    {
      lb.hide();
    }
  },
  /**
   * Update the current lightbox content.
   * @param type either "ajax" or "static"
   * @param value
   *   if type is ajax, the same format as the lb ajax config parameter.
   *   if type is static, the same format as the lb contents config parameter.
   */
  updateCurrentLightboxContent: function( type, value )
  {
    var lb = lightbox._currentLightbox;
    if ( lb )
    {
      var oldAjax = lb.cfg.ajax, oldContents = lb.cfg.contents;
      lb.cfg.ajax = ( type == 'ajax' ) ? value : false;
      lb.cfg.contents = ( type == 'ajax' ) ? null : value;
      lb._updateLightboxContent( function() {
        lb.cfg.ajax = oldAjax;
        lb.cfg.contents = oldContents;
      });
    }
  },
  /**
   * Parse a JSON representation of the config into an object suitable for
   * passing to the lb constructor.
   * @param serializedConfig JSON config string.
   */
  parseConfig: function( serializedConfig ) //Safely parses a JSON representation of the config
  {
    return serializedConfig ? serializedConfig.replace(/'/g, '"').evalJSON( true ) : {};
  },
  /**
   * Autowire all links.with the given class on the page to open in lb.  Call this after the page has loaded.
   * The "lb:options" attribute can be added to the link to specify a JSON-formatted config string
   * that will be parsed and passed to the lb constructor.
   * @param className class of link that will be autowired.
   */
  autowireLightboxes: function( className, parentEl )
  {
    if (!parentEl)
    {
      parentEl = document;
    }
    var links = parentEl.getElementsByTagName('a');
    for ( var i = 0, len = links.length; i < len; i++ )
    {
      var a = links[i];
      if ( page.util.hasClassName( a, className ) )
      {
        a = $(a);
        var defOptions = ( lightbox._imageTypeRE.test( a.href ) ? "{'contents':{'auto':true}}" : "{'ajax':true}" );
        new lightbox.Lightbox( Object.extend( { openLink: a }, lightbox.parseConfig( a.getAttribute('lb:options') || defOptions ) ) );
      }
    }
  }
};
}
/** The collection of classes and methods that comprise the QuickLinks core implementation. */
var quickLinks =
{
    constants :
    {
        /** Constant identifier for identifying frame communications specific to this function */
        APP_CONTEXT : 'QuickLinks',

        /** Hotkey for the Quick Links UI */
        APP_HOTKEY :
        {
            accesskey : 'l',
            modifiers :
            {
                shift : true,
                alt : true
            }
        },

        // Constants for various window actions
        SET : 'set',
        ADD : 'add',
        REMOVE : 'remove',
        SHOW : 'show',
        ACTIVATE : 'activate',
        REMOVE_ALL : 'removeAll',
        DEFINE_KEY : 'defineKey',

        /** The order in which we process windows */
        WINDOW_ORDER_FOR_HEADERS :
        {
            mybbCanvas : 1,
            WFS_Files : 2,
            content : 3,
            WFS_Navigation : 4,
            nav : 5,
            'default' : 100
        },

        /** ARIA roles that we consider 'landmarks' */
        ARIA_LANDMARK_ROLES :
        {
            application : true,
            banner : true,
            complementary : true,
            contentinfo : true,
            form : true,
            main : true,
            navigation : true,
            search : true
        }
    },

    vars :
    {
        /** reference to lightbox object */
        lightbox : null,

        /** cached quick link data */
        data : $H(),

        /** Messages must originate from one of these sources */
        trustedProviders : $H(),

        // Cached references to HTML elements
        lightboxLandmarkList : null,
        lightboxLandmarkSection : null,
        lightboxHeaderList : null,
        lightboxHeaderSection : null,
        lightboxHotkeyList : null,
        lightboxHotkeySection : null,

        /** The instance of helper for the window containing this script */
        helper : null
    },

    /** Initialization of the UI/core implementation */
    initialize : function( trustedProviders )
    {
      if (page.util.parentWindowIsUltraApp() || page.util.insideUltra())
      {
    	  var quickLinksWrap = $('quick_links_wrap');
          quickLinksWrap.hide();
      }

      // Initialize a lightbox to show collected links
      quickLinks.vars.lightbox = new lightbox.Lightbox(
      {
          title : page.bundle.getString( 'quick_links.lightbox_title' ),
          contents :
          {
            id : 'quickLinksLightboxDiv'
          },
          'dimensions' :
          {
              w : 800,
              h : 600
          }
      } );

      // Add trusted content providers from whom we accept messages
      if ( trustedProviders )
      {
        trustedProviders.each( function( tp )
        {
          if ( tp )
          {
            quickLinks.vars.trustedProviders.set( tp, true );
          }
        } );
      }
      quickLinks.vars.trustedProviders.set( quickLinks.util.getCurrentOrigin(), true );

      // Add listener for frame communications
      Event.observe( window.top, 'message', quickLinks.messageHelper.onMessageReceived );

      // When link is active, modify the wrapping div
      var wrapperDiv = $( 'quick_links_wrap' );
      Event.observe( $( 'quick_links_lightbox_link' ), 'focus', function( event )
      {
        this.addClassName( 'quick_link_wrap_focus' );
      }.bind( wrapperDiv ) );
      Event.observe( $( 'quick_links_lightbox_link' ), 'blur', function( event )
      {
        this.removeClassName( 'quick_link_wrap_focus' );
      }.bind( wrapperDiv ) );

      // Cache references to some elements
      quickLinks.vars.lightboxLandmarkList = $( 'quick_links_landmark_list' );
      quickLinks.vars.lightboxHeaderList = $( 'quick_links_heading_list' );
      quickLinks.vars.lightboxHotkeyList = $( 'quick_links_hotkey_list' );
      quickLinks.vars.lightboxLandmarkSection = $( 'quick_links_landmarks_section' );
      quickLinks.vars.lightboxHeaderSection = $( 'quick_links_headings_section' );
      quickLinks.vars.lightboxHotkeySection = $( 'quick_links_hotkeys_section' );
    },

    /** Factory method that creates a Helper for frames that require it */
    createHelper : function()
    {
      // If this is not a popup and this is not a top-level window without the quick links UI link
      // (for instance if someone opened one of the frames in a separate tab)
      if ( !window.opener && ( quickLinks.util.loadedInIframe() || $( 'quick_links_lightbox_link' ) ) )
      {
        if ( !quickLinks.vars.helper )
        {
          quickLinks.vars.helper = new quickLinks.Helper();
        }
      }
    },

    /**
     * Add a hot key definition. Not attached if in iframe.
     * 
     * @param hotkey is an object with keys label, accesskey, and modifiers. modifiers is an object with one or more of
     *          the keys -- control, shift, and alt -- set to a value expression that evaluates to true.
     * @param sourceId may be null and will default to the string used for all other quicklinks from the current window.
     */
    addHotKey : function( sourceId, hotkey )
    {
      if ( hotkey && !quickLinks.util.loadedInIframe() )
      {
        quickLinks.messageHelper.postMessage( window.top,
        {
            sourceId : sourceId || quickLinks.util.getCurrentWindowId(),
            context : quickLinks.constants.APP_CONTEXT,
            action : quickLinks.constants.ADD,
            hotkeys : [ hotkey ]
        }, quickLinks.util.getCurrentOrigin() );
      }
    },

    /**
     * Add hot key definition. See #addHotKey.
     * 
     * @param hotkeys hotkeys is an array of hotkey definitions as described in #addHotKey.
     */
    addHotKeys : function( sourceId, hotkeys )
    {
      if ( hotkeys && !quickLinks.util.loadedInIframe() )
      {
        quickLinks.messageHelper.postMessage( window.top,
        {
            sourceId : sourceId || quickLinks.util.getCurrentWindowId(),
            context : quickLinks.constants.APP_CONTEXT,
            action : quickLinks.constants.ADD,
            hotkeys : hotkeys
        }, quickLinks.util.getCurrentOrigin() );
      }
    },

    /**
     * Removes all content for the specified source. If sourceId evaluates to false, all content for the window that
     * calls this method will be removed.
     */
    removeAll : function( sourceId )
    {
      quickLinks.messageHelper.postMessage( window.top,
      {
          sourceId : sourceId,
          context : quickLinks.constants.APP_CONTEXT,
          action : quickLinks.constants.REMOVE_ALL
      }, quickLinks.util.getCurrentOrigin() );
    },

    /** A set of functions that deal with inter-window communication */
    messageHelper :
    {
        /** The handler for messages sent to window.top from other windows (or self) */
        onMessageReceived : function( event )
        {
          var data = quickLinks.messageHelper.translateData( event.data );
          if ( data && data.context === quickLinks.constants.APP_CONTEXT &&
               quickLinks.vars.trustedProviders.get( event.origin ) )
          {
            if ( data.action === quickLinks.constants.SET )
            {
              quickLinks.dataHelper.setQuickLinks( event.source, event.origin, data );
              quickLinks.messageHelper.postHotkey( event.source );
            }
            else if ( data.action === quickLinks.constants.SHOW )
            {
              quickLinks.lightboxHelper.toggleLightbox( data.sourceId, data.activeElementId, event.origin );
            }
            else if ( data.action === quickLinks.constants.REMOVE_ALL )
            {
              if ( data.sourceId )
              {
                quickLinks.vars.data.unset( data.sourceId );
              }
              else
              {
                // Remove all content from calling window
                quickLinks.vars.data.values().each( function( value )
                {
                  if ( value.window === event.source )
                  {
                    quickLinks.vars.data.unset( value.sourceId );
                  }
                } );
              }
            }
            else if ( data.action === quickLinks.constants.ADD )
            {
              quickLinks.dataHelper.addQuickLinks( event.source, event.origin, data );
            }
            else if ( data.action === quickLinks.constants.REMOVE )
            {
              quickLinks.dataHelper.removeQuickLinks( data );
            }
          }
        },

        /** Posts the supplied message to the target window */
        postMessage : function( w, data, target )
        {
          if ( w.postMessage )
          {
            if ( Prototype.Browser.IE && data && typeof ( data ) !== 'string' )
            {
              data = Object.toJSON( data );
            }
            w.postMessage( data, target );
          }
        },

        /** Handle IE's behavior of passing objects as strings */
        translateData : function( data )
        {
          if ( Prototype.Browser.IE && typeof ( data ) === 'string' && data.isJSON() )
          {
            data = data.evalJSON();
          }
          return data;
        },

        /** Sends a message the supplied window instance about the hot-key defined for the QuickLinks UI */
        postHotkey : function( w )
        {
          quickLinks.messageHelper.postMessage( w,
          {
              sourceId : quickLinks.util.getCurrentWindowId(),
              context : quickLinks.constants.APP_CONTEXT,
              action : quickLinks.constants.DEFINE_KEY,
              key : quickLinks.constants.APP_HOTKEY
          }, '*' );
        },

        /** Posts a message requesting the activation of the specified element */
        activateElement : function( sourceId, targetElementId, origin, isQuickLink )
        {
          // Reset focus
          quickLinks.vars.lightbox.cfg.onClose = null;
          quickLinks.vars.lightbox.cfg.focusOnClose = null;

          // Close lightbox
          quickLinks.lightboxHelper.closeLightbox();

          var windowEntry = quickLinks.vars.data.get( sourceId );

          // Focus on the target window
          windowEntry.window.focus();

          // Send a message to that window
          if ( windowEntry )
          {
            quickLinks.messageHelper.postMessage( windowEntry.window,
            {
                sourceId : quickLinks.util.getCurrentWindowId(),
                context : quickLinks.constants.APP_CONTEXT,
                action : quickLinks.constants.ACTIVATE,
                id : targetElementId,
                isQuickLink : isQuickLink
            }, origin );
          }
        }
    },

    /** A set of functions that deal with the management of the quick links data */
    dataHelper :
    {
        /** Create a hash for the hotkey definition */
        getHotKeyHash : function( key )
        {
          var result = key.accesskey;
          if ( key.modifiers )
          {
            result += key.modifiers.alt ? '-A' : '';
            result += key.modifiers.control ? '-C' : '';
            result += key.modifiers.shift ? '-S' : '';
          }
          return result;
        },

        /** Remove supplied quick links */
        removeQuickLinks : function( data )
        {
          var value = quickLinks.vars.data.get( data.sourceId );
          if ( value )
          {
            quickLinks.dataHelper.removeSelectionsById( value.headers, data.headers );
            quickLinks.dataHelper.removeSelectionsById( value.landmarks, data.landmarks );

            var selection =
            {};
            if ( data.hotkeys && value.hotkeys )
            {
              data.hotkeys.each( function( hotkey )
              {
                selection[ hotkey.id || quickLinks.dataHelper.getHotKeyHash( hotkey ) ] = true;
              } );
            }
            quickLinks.dataHelper.removeSelectionsById( value.hotkeys, selection );
          }
        },

        /** Remove those values from 'master' whose 'id' values exist in the 'selections' object */
        removeSelectionsById : function( master, selections )
        {
          if ( master && selections )
          {
            master = master.filter( function( i )
            {
              return i.id && !selections[ i.id ];
            } );
          }
          return master;
        },

        /** Overwrite any existing quick links */
        setQuickLinks : function( sourceWindow, origin, data )
        {
          quickLinks.vars.data.set( data.sourceId,
          {
              'window' : sourceWindow,
              sourceId : data.sourceId,
              origin : origin,
              headers : data.headers && [].concat(data.headers) || [],
              landmarks : data.landmarks && [].concat(data.landmarks) || [],
              hotkeys : quickLinks.dataHelper.normalizeHotKeys( data.hotkeys && [].concat(data.hotkeys) || [] )
          } );
        },

        /** Normalize the hotkey definition by adding the hash as an id if an id was not provided */
        normalizeHotKeys : function( hotkeys )
        {
          if ( hotkeys )
          {
            hotkeys.each( function( hotkey )
            {
              if ( !hotkey.id )
              {
                hotkey.id = quickLinks.dataHelper.getHotKeyHash( hotkey.key );
              }
            } );
          }
          return hotkeys;
        },

        /** Add quick links */
        addQuickLinks : function( sourceWindow, sourceOrigin, data )
        {
          var value = quickLinks.vars.data.get( data.sourceId );
          if ( !value )
          {
            value =
            {
                'window' : sourceWindow,
                sourceId : data.sourceId,
                origin : sourceOrigin,
                headers : [],
                landmarks : [],
                hotkeys : []
            };
            quickLinks.vars.data.set( data.sourceId, value );
          }
          if ( data.headers )
          {
            value.headers = value.headers.concat( data.headers );
          }
          if ( data.landmarks )
          {
            value.landmarks = value.landmarks.concat( data.landmarks );
          }
          if ( data.hotkeys )
          {
            value.hotkeys = value.hotkeys.concat( quickLinks.dataHelper.normalizeHotKeys( data.hotkeys ) );
          }
        }
    },

    /** A set of functions that deal with the management of the lightbox UI */
    'lightboxHelper' :
    {
        /** Toggles the QuickLinks lightbox state */
        toggleLightbox : function( targetWindowId, activeElementId, origin )
        {
          if ( lightbox.getCurrentLightbox() === quickLinks.vars.lightbox )
          {
            quickLinks.lightboxHelper.closeLightbox();
          }
          else
          {
            quickLinks.lightboxHelper.openLightbox( targetWindowId, activeElementId, origin );
          }
        },

        /** Opens the QuickLinks lightbox */
        openLightbox : function( targetWindowId, activeElementId, origin )
        {
          quickLinks.lightboxHelper.closeAllLightboxes();

          if ( targetWindowId && activeElementId && origin )
          {
            quickLinks.vars.lightbox.cfg.focusOnClose = null;
            quickLinks.vars.lightbox.cfg.onClose = function()
            {
              quickLinks.messageHelper.activateElement( targetWindowId, activeElementId, origin, false );
            }.bind( window.top );
          }
          else
          {
            quickLinks.vars.lightbox.cfg.onClose = null;
            quickLinks.vars.lightbox.cfg.focusOnClose = document.activeElement;
          }

          quickLinks.lightboxHelper.populateLightbox();
          quickLinks.vars.lightbox.open();
        },

        /** Closes the QuickLinks lightbox */
        closeLightbox : function()
        {
          quickLinks.lightboxHelper.clearLightboxContents();
          quickLinks.vars.lightbox.close();
        },

        /**
         * Close all open lightboxes. This will work only for lightboxes created using the core lightbox.js library and
         * opened from a frame that shares the same origin as window.top
         */
        closeAllLightboxes : function( w )
        {
          if ( !w )
          {
            w = window.top;
          }
          try
          {
            // Security errors appear in console even if we catch all exceptions, so try to avoid them
            if ( ( quickLinks.util.getCurrentOrigin() === quickLinks.util.getWindowOrigin( w ) ) && w.lightbox &&
                 w.lightbox.closeCurrentLightbox )
            {
              w.lightbox.closeCurrentLightbox();
            }
          }
          catch ( e )
          {
            // Ignore all exceptions -- probably caused by window of different origin
          }
          for ( var i = 0, iMax = w.frames.length; i < iMax; ++i )
          {
            quickLinks.lightboxHelper.closeAllLightboxes( w.frames[ i ] );
          }
        },

        /** Empties all content from the QuickLinks lightbox */
        clearLightboxContents : function()
        {
          quickLinks.vars.lightboxHeaderList.innerHTML = '';
          quickLinks.vars.lightboxLandmarkList.innerHTML = '';
          quickLinks.vars.lightboxHotkeyList.innerHTML = '';
        },

        /** Add known Quick Links to the lightbox UI after checking that they are still available on the page */
        populateLightbox : function()
        {
          if ( quickLinks.vars.data )
          {
            // Clear existing content
            quickLinks.lightboxHelper.clearLightboxContents();

            var keys = quickLinks.vars.data.keys();
            keys.sort( function( a, b )
            {
              var aWeight = quickLinks.constants.WINDOW_ORDER_FOR_HEADERS[ a ] ||
                            quickLinks.constants.WINDOW_ORDER_FOR_HEADERS[ 'default' ];
              var bWeight = quickLinks.constants.WINDOW_ORDER_FOR_HEADERS[ b ] ||
                            quickLinks.constants.WINDOW_ORDER_FOR_HEADERS[ 'default' ];
              return aWeight - bWeight;
            } );

            keys.each( function( key )
            {
              var value = quickLinks.vars.data.get( key );
              if ( value.window.closed )
              {
                delete quickLinks.vars.data[ key ];
                return;
              }

              if ( value.landmarks )
              {
                value.landmarks.each( quickLinks.lightboxHelper.populateLandmark.bind( value ) );
              }
              if ( value.headers )
              {
                value.headers.each( quickLinks.lightboxHelper.populateHeader.bind( value ) );
              }
              if ( value.hotkeys )
              {
                value.hotkeys.each( quickLinks.lightboxHelper.populateHotkey.bind( value ) );
              }
            } );

            // Display only sections that have content
            quickLinks.lightboxHelper.checkSection( quickLinks.vars.lightboxHeaderList,
                                                    quickLinks.vars.lightboxHeaderSection );
            quickLinks.lightboxHelper.checkSection( quickLinks.vars.lightboxLandmarkList,
                                                    quickLinks.vars.lightboxLandmarkSection );
            quickLinks.lightboxHelper.checkSection( quickLinks.vars.lightboxHotkeyList,
                                                    quickLinks.vars.lightboxHotkeySection );
          }
        },

        /** Figure out if the element has content and display the corresponding section */
        checkSection : function( el, section )
        {
          if ( el.empty() )
          {
            section.hide();
          }
          else
          {
            section.show();
          }
        },

        /** Adds a single landmark to the lightbox UI */
        populateLandmark : function( landmark )
        {
          var li = document.createElement( 'li' );
          quickLinks.vars.lightboxLandmarkList.appendChild( li );

          var a = $( document.createElement( 'a' ) );
          li.appendChild( a );
          a.innerHTML = landmark.label;
          a.setAttribute( 'href', '#' );
          a.setAttribute( 'onclick', 'quickLinks.messageHelper.activateElement("' + this.sourceId + '", "' +
                                     landmark.id + '", "' + this.origin + '", true)' );
          var title = page.bundle.getString( 'quick_links.link.title', this.sourceId, landmark.label, landmark.type );
          a.setAttribute( 'title', title );
        },

        /** Adds a single header to the lightbox UI */
        populateHeader : function( heading )
        {
          var li = document.createElement( 'li' );
          quickLinks.vars.lightboxHeaderList.appendChild( li );
          li.setAttribute( 'class', 'quick_links_header_' + heading.type.toLowerCase() );

          var a = $( document.createElement( 'a' ) );
          li.appendChild( a );
          a.innerHTML = heading.label;
          a.setAttribute( 'href', '#' );
          a.setAttribute( 'onclick', 'quickLinks.messageHelper.activateElement("' + this.sourceId + '", "' +
                                     heading.id + '", "' + this.origin + '", true)' );
          var title = page.bundle.getString( 'quick_links.link.title', this.sourceId, heading.label, heading.type );
          a.setAttribute( 'title', title );
        },

        /** Adds a single hot-key definitions to the lightbox UI */
        populateHotkey : function( hotkey )
        {
          var span;
          var plus = ' ' + page.bundle.getString( 'quick_links.hotkey.combination_divider' ) + ' ';

          var li = document.createElement( 'li' );
          quickLinks.vars.lightboxHotkeyList.appendChild( li );

          var div = $( document.createElement( 'div' ) );
          li.appendChild( div );
          div.setAttribute( 'class', 'keycombo' );

          if ( hotkey.key.modifiers )
          {
            if ( hotkey.key.modifiers.shift )
            {
              span = $( document.createElement( 'span' ) );
              div.appendChild( span );
              span.setAttribute( 'class', 'presskey' );
              span.innerHTML = page.bundle.getString( 'quick_links.hotkey.shift' );

              div.appendChild( document.createTextNode( plus ) );
            }

            if ( hotkey.key.modifiers.control )
            {
              span = $( document.createElement( 'span' ) );
              div.appendChild( span );
              span.setAttribute( 'class', 'presskey' );
              span.innerHTML = page.bundle.getString( 'quick_links.hotkey.control' );

              div.appendChild( document.createTextNode( plus ) );
            }

            if ( hotkey.key.modifiers.alt )
            {
              span = $( document.createElement( 'span' ) );
              div.appendChild( span );
              span.setAttribute( 'class', 'presskey' );
              span.innerHTML = page.bundle.getString( 'quick_links.hotkey.alt' );

              div.appendChild( document.createTextNode( plus ) );
            }
          }

          span = $( document.createElement( 'span' ) );
          div.appendChild( span );
          span.setAttribute( 'class', 'presskey alpha' );
          span.innerHTML = hotkey.key.accesskey;

          div.appendChild( document.createElement( 'br' ) );
          div.appendChild( document.createTextNode( hotkey.label ) );
        }
    },

    /** General helper functions that don't belong elsewhere */
    'util' :
    {
        /** Whether the current frame/page has a Course menu */
        isCoursePage : function()
        {
          return $( 'courseMenuPalette_paletteTitleHeading' ) ? true : false;
        },

        /** Whether the current frame/page is on the Content Collection tab */
        isContentSystemPage : function()
        {
          return quickLinks.util.getCurrentWindowId() === 'WFS_Files';
        },

        /** Returns the origin string for the current window as understood by the window.postMessage API */
        getCurrentOrigin : function()
        {
          return quickLinks.util.getWindowOrigin( window );
        },

        /** Returns the origin string for the supplied window as understood by the window.postMessage API */
        getWindowOrigin : function( w )
        {
          var url = w.location.href;
          return url.substring( 0, url.substring( 8 ).indexOf( '/' ) + 8 );
        },

        /** A name identifying the current window. Not guaranteed to be unique. */
        getCurrentWindowId : function()
        {
          if ( !window.name )
          {
            window.name = Math.floor( ( Math.random() * 10e6 ) + 1 );
          }
          return window.name;
        },

        /** @return "mac" if the client is running on a Mac and "win" otherwise */
        isMacClient : function()
        {
          return navigator.platform.toLowerCase().startsWith( "mac" );
        },

        /** The modifiers for access keys for the current platform/browser */
        getDefaultModifiers : function()
        {
          return ( quickLinks.util.isMacClient() ) ?
          {
              control : true,
              alt : true
          } :
          {
              shift : true,
              alt : true
          };
        },

        /** Whether this aria role is a 'landmark' */
        isAriaLandmark : function( el )
        {
          var role = el.getAttribute( 'role' );
          return role && quickLinks.constants.ARIA_LANDMARK_ROLES[ role.toLowerCase() ];
        },

        /** True if quick links is loaded in an iframe */
        loadedInIframe: function()
        {
          return window.self !== window.top;
        }
    },

    /**
     * Class used by all internally-sourced windows (anything that has a page tag that inherits from BasePageTag) to
     * communicate with quickLinks core
     */
    Helper : Class.create(
    {
        /** Constructor */
        initialize : function( config )
        {
          // Default values for configuration parameters.
          this.config = Object.extend(
          {
            trustedServer : quickLinks.util.getCurrentOrigin()
          }, config );

          Event.observe( window, 'message', this.onMessageReceived.bindAsEventListener( this ) );
          Event.observe( window, 'beforeunload', this.removeQuickLinks.bindAsEventListener( this ) );
          Event.observe( window, 'unload', this.stopParentObserving.bindAsEventListener( this ) );

          // Allow some time for other initialization to occur
          setTimeout( this.sendQuickLinks.bind( this ), 500 );
        },

        /** When window is unloaded */
        removeQuickLinks : function( event )
        {
          quickLinks.removeAll();
        },

        /**
        * Remove event listener on parent window. Used for when quick links is
        * in an iframe so the parent window won't be observing after iframe is
        * closed
        */
        stopParentObserving: function()
        {
          Event.stopObserving( window.top, 'message', quickLinks.messageHelper.onMessageReceived );
        },

        /** The handler for messages received from other window instances */
        onMessageReceived : function( event )
        {
          var data = quickLinks.messageHelper.translateData( event.data );
          if ( data && data.context === quickLinks.constants.APP_CONTEXT && event.origin === this.config.trustedServer )
          {
            if ( data.action === quickLinks.constants.ACTIVATE && data.id )
            {
              this.activateElement( $( data.id ), data.isQuickLink );
            }
            else if ( data.action === quickLinks.constants.DEFINE_KEY && data.key )
            {
              this.defineQuickLinksHotKey( event, data );
            }
          }
        },

        /** Defines the hotkey for the QuickLink UI */
        defineQuickLinksHotKey : function( event, data )
        {
          if ( this.keyDownHandler )
          {
            Event.stopObserving( document, 'keydown', this.keyDownHandler );
            this.keyDownHandler = null;
          }

          var source = event.source;
          var origin = event.origin;
          var key = data.key;

          this.keyDownHandler = function( ev )
          {
            var keyCode = ev.keyCode || ev.which;
            if ( ( String.fromCharCode( keyCode ).toLowerCase() === key.accesskey ) &&
                 ( !key.modifiers.shift || ev.shiftKey ) && ( !key.modifiers.alt || ev.altKey ) &&
                 ( !key.modifiers.control || ev.ctrlKey ) )
            {
              quickLinks.messageHelper.postMessage( source,
              {
                  sourceId : quickLinks.util.getCurrentWindowId(),
                  context : quickLinks.constants.APP_CONTEXT,
                  action : quickLinks.constants.SHOW,
                  activeElementId : document.activeElement ? $( document.activeElement ).identify() : null
              }, origin );
              ev.stop();
              return false;
            }
          }.bindAsEventListener( this );
          Event.observe( document, 'keydown', this.keyDownHandler );
        },

        /** Activates the specified element (focus or click as applicable) */
        activateElement : function( el, isQuickLink )
        {
          if ( el )
          {
            // Allow the element to accept focus temporarily
            var tabidx = el.getAttribute( 'tabindex' );
            if ( isQuickLink && !tabidx && tabidx !== 0 )
            {
              el.setAttribute( 'tabIndex', 0 );
            }

            // Pulsate for a few seconds if the element is visible
            if ( isQuickLink && el.visible() )
            {
              try
              {
                Effect.Pulsate( el );
              }
              catch ( e )
              {
                // Ignore all errors
              }
            }

            // Focus on the element
            el.focus();

            // Remove the tabindex so that we don't stop at this element later
            if ( isQuickLink && !tabidx && ( tabidx !== 0 ) )
            {
              el.setAttribute( 'tabIndex', Prototype.Browser.IE ? '-1' : '' );
            }
          }
        },

        /** Discovers quick links in the current window and sends them to the top window */
        sendQuickLinks : function()
        {
          var helper = this;

          var hotkeys = this.getElements( 'a[accesskey]', false, 'title' );
          if ( !quickLinks.util.loadedInIframe() )
          {
            hotkeys.push(
            {
                label : page.bundle.getString( 'quick_links.link_title' ),
                key : quickLinks.constants.APP_HOTKEY
            } );
          }
          var headers = this.getElements( [ 'h1', 'h2', 'h3', 'h4', 'h5', 'h6' ], true );
          if ( quickLinks.util.isCoursePage() || quickLinks.util.isContentSystemPage() )
          {
            headers = this.modifyHeaderOrder( headers );
          }
          var landmarks = this.getElements( '[role]', false, 'role', 'title', quickLinks.util.isAriaLandmark
              .bind( this ) );

          quickLinks.messageHelper.postMessage( window.top,
          {
              sourceId : quickLinks.util.getCurrentWindowId(),
              context : quickLinks.constants.APP_CONTEXT,
              action : quickLinks.constants.SET,
              headers : headers,
              landmarks : landmarks,
              hotkeys : hotkeys
          }, this.config.trustedServer );
        },

        /**
         * Find elements matching the supplied pattern, using the value of the attribute labelAttribute as the label.
         * Returns an array of Objects with each having the properties id, type, label, and key.
         */
        getElements : function( pattern, inspectAncestors, labelAttribute, parenAttribute, isValidQuickLink )
        {
          var helper = this;
          var result = [];
          var modifiers = quickLinks.util.getDefaultModifiers();
          $$( pattern ).each( function( el )
          {
            if ( !helper.isAvailableAsQuickLink( el, inspectAncestors ) )
            {
              return;
            }

            if ( isValidQuickLink && !isValidQuickLink( el ) )
            {
              return;
            }

            var id = el.getAttribute( 'id' );
            if ( !id )
            {
              id = el.identify();
            }
            var label = helper.getLabel( el, labelAttribute, parenAttribute );

            result.push(
            {
                id : id,
                type : el.tagName.toLowerCase(),
                label : label,
                key :
                {
                    modifiers : modifiers,
                    accesskey : el.getAttribute( 'accesskey' )
                }
            } );
          } );
          return result;
        },

        /** Whether the specified element should be shown in the QuickLinks UI */
        isAvailableAsQuickLink : function( element, inspectAncestors )
        {
          // Skip all checks if this is explicitly marked as a quick link or otherwise
          if ( element.hasClassName( 'quickLink' ) )
          {
            return true;
          }
          if ( element.hasClassName( 'hideFromQuickLinks' ) )
          {
            return false;
          }

          // If element is not visible, don't show it.
          if ( ( element.getStyle( 'zIndex' ) !== null ) || !element.visible() )
          {
            return false;
          }

          if ( inspectAncestors )
          {
            // Look for a hidden ancestor
            var elArray = element.ancestors();
            for ( var i = 0, iMax = elArray.length; i < iMax; ++i )
            {
              var el = elArray[ i ];
              var elName = el.tagName.toLowerCase();

              // Stop when we reach the body
              if ( elName === 'body' || elName === 'html' )
              {
                break;
              }

              if ( typeof el.visible === 'function' && !el.visible() )
              {
                return false;
              }
            }
          }

          return true;
        },

        /** Get the QuickLinks label for the specified element */
        getLabel : function( el, labelAttribute, parenAttribute )
        {
          var label = labelAttribute ? el.getAttribute( labelAttribute ) : null;
          if ( !label )
          {
            label = el.innerHTML.stripTags();
          }
          if ( label && parenAttribute )
          {
            var parenValue = el.getAttribute( parenAttribute );
            if ( parenValue )
            {
              label = page.bundle.getString( 'common.pair.paren', label, parenValue );
            }
          }
          return label;
        },

        /** Hack the order of headers for Course and Content System pages. It is Ugly, but it's also a requirement. */
        modifyHeaderOrder : function( headers )
        {
          if ( headers && headers.length > 0 )
          {
            var i, iMax;
            for ( i = 0, iMax = headers.length; i < iMax; ++i )
            {
              if ( headers[ i ].type.toLowerCase() === 'h1' )
              {
                break;
              }
            }
            if ( i !== 0 && i < iMax )
            {
              // move everything above the h1 to the bottom of the list
              var removed = headers.splice( 0, i );
              headers = headers.concat( removed );
            }
          }
          return headers;
        }
    } )
};