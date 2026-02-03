/*! seed v0.0.1 - UMD format */
// LICENSE.md
/*
The MIT License (MIT)

Copyright (c) 2013 Yuxi Evan You

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
/*
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD
        define(factory);
    } else if (typeof exports === 'object') {
        // CommonJS
        module.exports = factory();
    } else {
        // 浏览器全局变量
        root.seed = factory();
    }
}(this, function () {
    'use strict';

    // 初始化 seed 对象
    var seed = {};

    /* ===== 配置模块 ===== */
    var config = {
        prefix: 'sd',
        interpolateTags: {
            open: '{{',
            close: '}}'
        },
        controllers: {},
        datum: {}
    };

    /* ===== 工具函数 ===== */
    // 类型检测
    var toString = Object.prototype.toString;
    function typeOf (obj) {
        return toString.call(obj).slice(8, -1);
    }

    /* ===== Emitter 模块 ===== */
    // 简化版 Emitter，替代 component/emitter
    function Emitter(obj) {
        if (obj) return mixin(obj);
        this._callbacks = {};
    }

    function mixin(obj) {
        for (var key in Emitter.prototype) {
            obj[key] = Emitter.prototype[key];
        }
        return obj;
    }

    Emitter.prototype.on = function(event, fn){
        (this._callbacks[event] = this._callbacks[event] || [])
            .push(fn);
        return this;
    };

    Emitter.prototype.once = function(event, fn){
        var self = this;
        function on() {
            self.off(event, on);
            fn.apply(this, arguments);
        }
        on.fn = fn;
        this.on(event, on);
        return this;
    };

    Emitter.prototype.off = function(event, fn){
        var callbacks = this._callbacks[event];
        if (!callbacks) return this;

        // 移除所有事件监听
        if (arguments.length === 1) {
            delete this._callbacks[event];
            return this;
        }

        // 移除特定回调
        var cb;
        for (var i = 0; i < callbacks.length; i++) {
            cb = callbacks[i];
            if (cb === fn || cb.fn === fn) {
                callbacks.splice(i, 1);
                break;
            }
        }
        return this;
    };

    Emitter.prototype.emit = function(event){
        var callbacks = this._callbacks[event];
        if (callbacks) {
            callbacks = callbacks.slice(0);
            for (var i = 0, len = callbacks.length; i < len; ++i) {
                callbacks[i].apply(this, Array.prototype.slice.call(arguments, 1));
            }
        }
        return this;
    };

    /* ===== 文本解析器模块 ===== */
    var ESCAPE_RE = /[-.*+?^${}()|[\]\/\\]/g;
    var BINDING_RE;

    function escapeRegex(val) {
        return val.replace(ESCAPE_RE, '\\$&');
    }

    var textParser = {
        parse: function (node) {
            var text = node.nodeValue;
            if (!BINDING_RE.test(text)) return null;
            var m, i, tokens = [];
            do {
                m = text.match(BINDING_RE);
                if (!m) break;
                i = m.index;
                if (i > 0) tokens.push(text.slice(0, i));
                tokens.push({ key: m[1] });
                text = text.slice(i + m[0].length);
            } while (true);
            if (text.length) tokens.push(text);
            return tokens;
        },

        buildRegex: function () {
            var open = escapeRegex(config.interpolateTags.open);
            var close = escapeRegex(config.interpolateTags.close);
            BINDING_RE = new RegExp(open + '(.+?)' + close);
        }
    };

    /* ===== 过滤器模块 ===== */
    var keyCodes = {
        enter: 13,
        tab: 9,
        'delete': 46,
        up: 38,
        left: 37,
        right: 39,
        down: 40
    };

    var filters = {
        capitalize: function (value) {
            value = value.toString();
            return value.charAt(0).toUpperCase() + value.slice(1);
        },

        uppercase: function (value) {
            return value.toString().toUpperCase();
        },

        lowercase: function (value) {
            return value.toString().toLowerCase();
        },

        currency: function (value, args) {
            if (!value) return value;
            var sign = (args && args[0]) || '$';
            var i = value % 3;
            var f = '.' + value.toFixed(2).slice(-2);
            var s = Math.floor(value).toString();
            return sign + s.slice(0, i) + s.slice(i).replace(/(\d{3})(?=\d)/g, '$1,') + f;
        },

        key: function (handler, args) {
            var code = keyCodes[args[0]];
            if (!code) {
                code = parseInt(args[0], 10);
            }
            return function (e) {
                if (e.originalEvent.keyCode === code) {
                    handler(e);
                }
            };
        }
    };

    /* ===== 指令模块 ===== */
    var KEY_RE = /^[^\|<]+/;
    var ARG_RE = /([^:]+):(.+)$/;
    var FILTERS_RE = /\|[^\|<]+/g;
    var FILTER_TOKEN_RE = /[^\s']+|'[^']+'/g;
    var INVERSE_RE = /^!/;
    var NESTING_RE = /^\^+/;
    var ONEWAY_RE = /-oneway$/;

    // 指令类
    function Directive(directiveName, expression, oneway) {
        var prop;
        var definition = directives[directiveName];

        // 混入指令定义的属性
        if (typeof definition === 'function') {
            this._update = definition;
        } else {
            this._update = definition.update;
            for (prop in definition) {
                if (prop !== 'update') {
                    this[prop] = definition[prop];
                }
            }
        }

        this.oneway = !!oneway;
        this.directiveName = directiveName;
        this.expression = expression.trim();
        this.rawKey = expression.match(KEY_RE)[0];
        
        var keyInfo = parseKey(this.rawKey);
        for (prop in keyInfo) {
            this[prop] = keyInfo[prop];
        }
        
        var filterExps = expression.match(FILTERS_RE);
        this.filters = filterExps
            ? filterExps.map(parseFilter)
            : null;
    }

    Directive.prototype.refresh = function () {
        var value = this.value.get();
        if (this.inverse) value = !value;
        this._update(
            this.filters
            ? this.applyFilters(value)
            : value
        );
        this.binding.emitChange();
    };

    Directive.prototype.update = function (value) {
        if (value && (value === this.value)) return;
        this.value = value;
        // 计算属性
        if (typeof value === 'function' && !this.expectFunction) {
            value = value();
        }
        if (this.inverse) value = !value;
        this._update(
            this.filters
            ? this.applyFilters(value)
            : value
        );
        if (this.binding.isComputed) {
            this.refresh();
        }
    };

    Directive.prototype.applyFilters = function (value) {
        var filtered = value;
        this.filters.forEach(function (filter) {
            if (!filter.apply) throw new Error('Unknown filter: ' + filter.name);
            filtered = filter.apply(filtered, filter.args);
        });
        return filtered;
    };

    function parseKey(rawKey) {
        var res = {};
        var argMatch = rawKey.match(ARG_RE);

        res.key = argMatch
            ? argMatch[2].trim()
            : rawKey.trim();

        res.arg = argMatch
            ? argMatch[1].trim()
            : null;

        res.inverse = INVERSE_RE.test(res.key);
        if (res.inverse) {
            res.key = res.key.slice(1);
        }

        var nesting = res.key.match(NESTING_RE);
        res.nesting = nesting
            ? nesting[0].length
            : false;

        res.root = res.key.charAt(0) === '$';

        if (res.nesting) {
            res.key = res.key.replace(NESTING_RE, '');
        } else if (res.root) {
            res.key = res.key.slice(1);
        }

        return res;
    }

    function parseFilter(filter) {
        var tokens = filter.slice(1)
            .match(FILTER_TOKEN_RE)
            .map(function (token) {
                return token.replace(/'/g, '').trim();
            });

        return {
            name: tokens[0],
            apply: filters[tokens[0]],
            args: tokens.length > 1
                ? tokens.slice(1)
                : null
        };
    }

    var directiveParser = {
        parse: function (dirname, expression) {
            var prefix = config.prefix;
            if (dirname.indexOf(prefix) === -1) return null;
            dirname = dirname.slice(prefix.length + 1);

            var oneway = ONEWAY_RE.test(dirname);
            if (oneway) {
                dirname = dirname.slice(0, -7);
            }

            var dir = directives[dirname];
            var valid = KEY_RE.test(expression);

            if (!dir) console.warn('unknown directive: ' + dirname);
            if (!valid) console.warn('invalid directive expression: ' + expression);

            return dir && valid
                ? new Directive(dirname, expression, oneway)
                : null;
        }
    };

    /* ===== 绑定模块 ===== */
    var arrayMutators = ['push','pop','shift','unshift','splice','sort','reverse'];
    var arrayAugmentations = {
        remove: function (index) {
            if (typeof index !== 'number') index = index.$index;
            this.splice(index, 1);
        },
        replace: function (index, data) {
            if (typeof index !== 'number') index = index.$index;
            this.splice(index, 1, data);
        }
    };

    function watchArray(collection) {
        Emitter(collection);
        arrayMutators.forEach(function (method) {
            collection[method] = function () {
                var result = Array.prototype[method].apply(this, arguments);
                collection.emit('mutate', {
                    method: method,
                    args: Array.prototype.slice.call(arguments),
                    result: result
                });
                return result;
            };
        });
        for (var method in arrayAugmentations) {
            collection[method] = arrayAugmentations[method];
        }
    }

    function Binding(value) {
        this.value = value;
        this.instances = [];
        this.dependents = [];
    }

    Binding.prototype.set = function (value) {
        var type = typeOf(value);
        var self = this;
        // 根据类型预处理值
        if (type === 'Object') {
            if (value.get) { // 计算属性
                self.isComputed = true;
            } else { // 普通对象
                // TODO watchObject
            }
        } else if (type === 'Array') {
            watchArray(value);
            value.on('mutate', function () {
                self.emitChange();
            });
        }
        this.value = value;
    };

    Binding.prototype.update = function (value) {
        this.set(value);
        this.instances.forEach(function (instance) {
            instance.update(value);
        });
        this.emitChange();
    };

    Binding.prototype.emitChange = function () {
        this.dependents.forEach(function (dept) {
            dept.refresh();
        });
    };

    /* ===== 指令定义模块 ===== */
    var directives = {};

    // 事件委托辅助函数
    function delegateCheck(current, top, marker) {
        if (current[marker]) {
            return current;
        } else if (current === top) {
            return false;
        } else {
            return delegateCheck(current.parentNode, top, marker);
        }
    }

    // on 指令
    directives.on = {
        expectFunction: true,

        bind: function () {
            if (this.seed.each) {
                this.el[this.expression] = true;
                this.el.seed = this.seed;
            }
        },

        update: function (handler) {
            this.unbind();
            if (!handler) return;
            var self = this;
            var event = this.arg;
            
            if (this.seed.each && event !== 'blur' && event !== 'blur') {
                // 对于 each 块，使用事件委托提高性能
                // focus 和 blur 事件不冒泡，所以排除它们
                var delegator = this.seed.delegator;
                if (!delegator) return;
                var marker = this.expression;
                var dHandler = delegator.sdDelegationHandlers[marker];
                
                // 这只会运行一次！
                if (!dHandler) {
                    dHandler = delegator.sdDelegationHandlers[marker] = function (e) {
                        var target = delegateCheck(e.target, delegator, marker);
                        if (target) {
                            handler({
                                originalEvent: e,
                                el: target,
                                scope: target.seed.scope
                            });
                        }
                    };
                    dHandler.event = event;
                    delegator.addEventListener(event, dHandler);
                }
            } else {
                // 普通处理器
                this.handler = function (e) {
                    handler({
                        originalEvent: e,
                        el: e.currentTarget,
                        scope: self.seed.scope
                    });
                };
                this.el.addEventListener(event, this.handler);
            }
        },

        unbind: function () {
            this.el.removeEventListener(this.arg, this.handler);
        }
    };

    // each 指令的变异处理器
    var mutationHandlers = {
        push: function (m) {
            var self = this;
            m.args.forEach(function (data, i) {
                var seed = self.buildItem(data, self.collection.length + i);
                self.container.insertBefore(seed.el, self.marker);
            });
        },

        pop: function (m) {
            m.result.$destroy();
        },

        unshift: function (m) {
            var self = this;
            m.args.forEach(function (data, i) {
                var seed = self.buildItem(data, i);
                var ref = self.collection.length > m.args.length
                    ? self.collection[m.args.length].$el
                    : self.marker;
                self.container.insertBefore(seed.el, ref);
            });
            self.updateIndexes();
        },

        shift: function (m) {
            m.result.$destroy();
            var self = this;
            self.updateIndexes();
        },

        splice: function (m) {
            var self = this;
            var index = m.args[0];
            var removed = m.args[1];
            var added = m.args.length - 2;
            m.result.forEach(function (scope) {
                scope.$destroy();
            });
            if (added > 0) {
                m.args.slice(2).forEach(function (data, i) {
                    var seed = self.buildItem(data, index + i);
                    var pos = index - removed + added + 1;
                    var ref = self.collection[pos]
                        ? self.collection[pos].$el
                        : self.marker;
                    self.container.insertBefore(seed.el, ref);
                });
            }
            if (removed !== added) {
                self.updateIndexes();
            }
        },

        sort: function () {
            var self = this;
            self.collection.forEach(function (scope, i) {
                scope.$index = i;
                self.container.insertBefore(scope.$el, self.marker);
            });
        }
    };

    mutationHandlers.reverse = mutationHandlers.sort;

    // each 指令
    directives.each = {
        bind: function () {
            this.el.removeAttribute(config.prefix + '-each');
            var ctn = this.container = this.el.parentNode;
            this.marker = document.createComment('sd-each-' + this.arg);
            ctn.insertBefore(this.marker, this.el);
            this.delegator = this.el.parentNode;
            ctn.removeChild(this.el);
        },

        update: function (collection) {
            this.unbind(true);
            // 事件委托
            if (!Array.isArray(collection)) return;
            this.collection = collection;
            this.delegator.sdDelegationHandlers = {};
            var self = this;
            
            collection.on('mutate', function (mutation) {
                mutationHandlers[mutation.method].call(self, mutation);
            });
            
            collection.forEach(function (data, i) {
                var seed = self.buildItem(data, i);
                self.container.insertBefore(seed.el, self.marker);
            });
        },

        buildItem: function (data, index) {
            var node = this.el.cloneNode(true);
            var spore = new Seed(node, {
                each: true,
                eachPrefixRE: new RegExp('^' + this.arg + '.'),
                parentSeed: this.seed,
                index: index,
                data: data,
                delegator: this.delegator
            });
            this.collection[index] = spore.scope;
            return spore;
        },

        updateIndexes: function () {
            this.collection.forEach(function (scope, i) {
                scope.$index = i;
            });
        },

        unbind: function (reset) {
            if (this.collection && this.collection.length) {
                var fn = reset ? '_destroy' : '_unbind';
                this.collection.forEach(function (scope) {
                    scope.$seed[fn]();
                });
                this.collection = null;
            }
            var delegator = this.delegator;
            if (delegator) {
                var handlers = delegator.sdDelegationHandlers;
                for (var key in handlers) {
                    delegator.removeEventListener(handlers[key].event, handlers[key]);
                }
                delete delegator.sdDelegationHandlers;
            }
        }
    };

    // 其他指令
    directives.attr = function (value) {
        this.el.setAttribute(this.arg, value);
    };

    directives.text = function (value) {
        this.el.textContent =
            (typeof value === 'string' || typeof value === 'number')
            ? value : '';
    };

    directives.html = function (value) {
        this.el.innerHTML =
            (typeof value === 'string' || typeof value === 'number')
            ? value : '';
    };

    directives.show = function (value) {
        this.el.style.display = value ? '' : 'none';
    };

    directives.visible = function (value) {
        this.el.style.visibility = value ? '' : 'hidden';
    };
    
    directives.focus = function (value) {
        this.el[value ? 'focus' : 'blur']();
    };

    directives.class = function (value) {
        if (this.arg) {
            this.el.classList[value ? 'add' : 'remove'](this.arg);
        } else {
            if (this.lastVal) {
                this.el.classList.remove(this.lastVal);
            }
            this.el.classList.add(value);
            this.lastVal = value;
        }
    };

    directives.value = {
        bind: function () {
            if (this.oneway) return;
            var el = this.el;
            var self = this;
            this.change = function () {
                self.seed.scope[self.key] = el.value;
            };
            el.addEventListener('change', this.change);
        },
        update: function (value) {
            this.el.value = value;
        },
        unbind: function () {
            if (this.oneway) return;
            this.el.removeEventListener('change', this.change);
        }
    };

    directives.checked = {
        bind: function () {
            if (this.oneway) return;
            var el = this.el;
            var self = this;
            this.change = function () {
                self.seed.scope[self.key] = el.checked;
            };
            el.addEventListener('change', this.change);
        },
        update: function (value) {
            this.el.checked = !!value;
        },
        unbind: function () {
            if (this.oneway) return;
            this.el.removeEventListener('change', this.change);
        }
    };

    directives['if'] = {
        bind: function () {
            this.parent = this.el.parentNode;
            this.ref = document.createComment('sd-if-' + this.key);
            var next = this.el.nextSibling;
            if (next) {
                this.parent.insertBefore(this.ref, next);
            } else {
                this.parent.appendChild(this.ref);
            }
        },
        update: function (value) {
            if (!value) {
                if (this.el.parentNode) {
                    this.parent.removeChild(this.el);
                }
            } else {
                if (!this.el.parentNode) {
                    this.parent.insertBefore(this.el, this.ref);
                }
            }
        }
    };

    // CSS属性转换
    var CONVERT_RE = /-(.)/g;
    function convertCSSProperty(prop) {
        if (prop.charAt(0) === '-') prop = prop.slice(1);
        return prop.replace(CONVERT_RE, function (m, char) {
            return char.toUpperCase();
        });
    }

    directives.style = {
        bind: function () {
            this.arg = convertCSSProperty(this.arg);
        },
        update: function (value) {
            this.el.style[this.arg] = value;
        }
    };

    /* ===== Seed 类 (核心) ===== */
    var slice = Array.prototype.slice;
    var ctrlAttr = config.prefix + '-controller';
    var eachAttr = config.prefix + '-each';
    var depsObserver = new Emitter();
    var parsingDeps = false;

    // 主 ViewModel 类
    function Seed(el, options) {
        if (typeof el === 'string') {
            el = document.querySelector(el);
        }

        this.el = el;
        el.seed = this;
        this._bindings = {};
        this._computed = [];

        // 复制选项
        options = options || {};
        for (var op in options) {
            this[op] = options[op];
        }

        // 检查是否有传入的数据
        var dataAttr = config.prefix + '-data';
        var dataId = el.getAttribute(dataAttr);
        var data = (options && options.data) || config.datum[dataId] || {};
        el.removeAttribute(dataAttr);

        // 如果传入的数据是 Seed 实例的作用域，则从中复制
        if (data.$seed instanceof Seed) {
            data = data.$dump();
        }

        // 初始化作用域对象
        var scope = this.scope = {};

        scope.$el = el;
        scope.$seed = this;
        scope.$destroy = this._destroy.bind(this);
        scope.$dump = this._dump.bind(this);
        scope.$index = options.index;
        scope.$parent = options.parentSeed && options.parentSeed.scope;

        // 复制数据
        for (var key in data) {
            scope[key] = data[key];
        }

        // 如果有控制器函数，应用它以获取所有用户定义
        var ctrlID = el.getAttribute(ctrlAttr);
        if (ctrlID) {
            el.removeAttribute(ctrlAttr);
            var factory = config.controllers[ctrlID];
            if (factory) {
                factory(this.scope);
            } else {
                console.warn('controller ' + ctrlID + ' is not defined.');
            }
        }

        // 添加事件监听器，在属性设置时更新相应的绑定
        var self = this;
        this.on('set', function (key, value) {
            self._bindings[key].update(value);
        });

        // 解析 DOM
        this._compileNode(el, true);

        // 提取计算属性的依赖
        parsingDeps = true;
        this._computed.forEach(parseDeps);
        this._computed.forEach(injectDeps);
        delete this._computed;
        parsingDeps = false;
    }

    // 编译 DOM 节点（递归）
    Seed.prototype._compileNode = function (node, root) {
        var seed = this;

        if (node.nodeType === 3) { // 文本节点
            seed._compileTextNode(node);
        } else if (node.nodeType === 1) {
            var eachExp = node.getAttribute(eachAttr);
            var ctrlExp = node.getAttribute(ctrlAttr);

            if (eachExp) { // each 块
                var directive = directiveParser.parse(eachAttr, eachExp);
                if (directive) {
                    directive.el = node;
                    seed._bind(directive);
                }
            } else if (ctrlExp && !root) { // 嵌套控制器
                new Seed(node, {
                    child: true,
                    parentSeed: seed
                });
            } else { // 普通节点
                // 解析属性
                if (node.attributes && node.attributes.length) {
                    slice.call(node.attributes).forEach(function (attr) {
                        if (attr.name === ctrlAttr) return;
                        var valid = false;
                        attr.value.split(',').forEach(function (exp) {
                            var directive = directiveParser.parse(attr.name, exp);
                            if (directive) {
                                valid = true;
                                directive.el = node;
                                seed._bind(directive);
                            }
                        });
                        if (valid) node.removeAttribute(attr.name);
                    });
                }

                // 递归编译子节点
                if (node.childNodes.length) {
                    slice.call(node.childNodes).forEach(function (child) {
                        seed._compileNode(child);
                    });
                }
            }
        }
    };

    // 编译文本节点
    Seed.prototype._compileTextNode = function (node) {
        var tokens = textParser.parse(node);
        if (!tokens) return;
        var seed = this;
        var dirname = config.prefix + '-text';
        tokens.forEach(function (token) {
            var el = document.createTextNode('');
            if (token.key) {
                var directive = directiveParser.parse(dirname, token.key);
                if (directive) {
                    directive.el = el;
                    seed._bind(directive);
                }
            } else {
                el.nodeValue = token;
            }
            node.parentNode.insertBefore(el, node);
        });
        node.parentNode.removeChild(node);
    };

    // 将指令实例添加到正确的绑定和作用域
    Seed.prototype._bind = function (directive) {
        var key = directive.key;
        var seed = directive.seed = this;

        if (this.each) {
            if (this.eachPrefixRE && this.eachPrefixRE.test(key)) {
                key = directive.key = key.replace(this.eachPrefixRE, '');
            } else {
                seed = this.parentSeed;
            }
        }

        seed = getScopeOwner(directive, seed);
        var binding = seed._bindings[key] || seed._createBinding(key);

        // 将指令添加到绑定
        binding.instances.push(directive);
        directive.binding = binding;

        // 如果存在 bind 钩子，则调用
        if (directive.bind) {
            directive.bind(binding.value);
        }

        // 设置初始值
        directive.update(binding.value);
    };

    // 创建绑定并将 getter/setter 附加到作用域对象
    Seed.prototype._createBinding = function (key) {
        var binding = new Binding();
        binding.set(this.scope[key]);
        this._bindings[key] = binding;
        if (binding.isComputed) this._computed.push(binding);

        var seed = this;
        Object.defineProperty(this.scope, key, {
            get: function () {
                if (parsingDeps) {
                    depsObserver.emit('get', binding);
                }
                seed.emit('get', key);
                return binding.isComputed
                    ? binding.value.get()
                    : binding.value;
            },
            set: function (value) {
                if (value === binding.value) return;
                seed.emit('set', key, value);
            }
        });

        return binding;
    };

    // 调用所有指令实例的 unbind() 来移除事件监听器、销毁子种子等
    Seed.prototype._unbind = function () {
        var unbind = function (instance) {
            if (instance.unbind) {
                instance.unbind();
            }
        };
        for (var key in this._bindings) {
            this._bindings[key].instances.forEach(unbind);
        }
    };

    // 解绑并移除元素
    Seed.prototype._destroy = function () {
        this._unbind();
        this.el.parentNode.removeChild(this.el);
    };

    // 转储当前作用域数据的副本，排除 seed 暴露的属性
    Seed.prototype._dump = function () {
        var dump = {};
        var binding, val;
        var subDump = function (scope) {
            return scope.$dump();
        };
        for (var key in this._bindings) {
            binding = this._bindings[key];
            val = binding.value;
            if (!val) continue;
            if (Array.isArray(val)) {
                dump[key] = val.map(subDump);
            } else if (typeof val !== 'function') {
                dump[key] = val;
            } else if (binding.isComputed) {
                dump[key] = val.get();
            }
        }
        return dump;
    };

    // 辅助函数：自动提取计算属性的依赖
    function parseDeps(binding) {
        binding.dependencies = [];
        depsObserver.on('get', function (dep) {
            binding.dependencies.push(dep);
        });
        binding.value.get();
        depsObserver.off('get');
    }

    // 辅助函数：依赖提取的第二遍
    function injectDeps(binding) {
        binding.dependencies.forEach(function (dep) {
            if (!dep.dependencies || !dep.dependencies.length) {
                dep.dependents.push.apply(dep.dependents, binding.instances);
            }
        });
    }

    // 辅助函数：根据嵌套符号确定键所属的作用域
    function getScopeOwner(key, seed) {
        if (key.nesting) {
            var levels = key.nesting;
            while (seed.parentSeed && levels--) {
                seed = seed.parentSeed;
            }
        } else if (key.root) {
            while (seed.parentSeed) {
                seed = seed.parentSeed;
            }
        }
        return seed;
    }

    // 将 Emitter 混入 Seed.prototype
    Emitter(Seed.prototype);

    /* ===== 公共 API ===== */
    var controllers = config.controllers;
    var datum = config.datum;
    var reserved = ['datum', 'controllers'];

    // 存储一段纯数据到 config.datum，以便 sd-data 使用
    seed.data = function (id, data) {
        if (!data) return datum[id];
        if (datum[id]) {
            console.warn('data object "' + id + '"" already exists and has been overwritten.');
        }
        datum[id] = data;
    };

    // 存储控制器函数到 config.controllers，以便 sd-controller 使用
    seed.controller = function (id, extensions) {
        if (!extensions) return controllers[id];
        if (controllers[id]) {
            console.warn('controller "' + id + '" already exists and has been overwritten.');
        }
        controllers[id] = extensions;
    };

    // 允许用户创建自定义指令
    seed.directive = function (name, fn) {
        if (!fn) return directives[name];
        directives[name] = fn;
    };

    // 允许用户创建自定义过滤器
    seed.filter = function (name, fn) {
        if (!fn) return filters[name];
        filters[name] = fn;
    };

    // 引导整个框架，为具有 sd-controller 或 sd-data 的顶级节点创建 Seed 实例
    seed.bootstrap = function (opts) {
        if (opts) {
            for (var key in opts) {
                if (reserved.indexOf(key) === -1) {
                    config[key] = opts[key];
                }
            }
        }
        textParser.buildRegex();
        var el;
        var ctrlSlt = '[' + config.prefix + '-controller]';
        var dataSlt = '[' + config.prefix + '-data]';
        /* jshint boss: true */
        while (el = document.querySelector(ctrlSlt) || document.querySelector(dataSlt)) {
            new Seed(el);
        }
    };

    // 导出 Seed 构造函数
    seed.Seed = Seed;

    // 返回 seed 对象
    return seed;
}));
