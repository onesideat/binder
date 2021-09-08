const Binder = function(el, options) {
    const _ = this;

    // options
    _.opts = Object.assign({
        prefix: 'x',
        delimiters: ['{{', '}}']
    }, options.config);

    // element
    _.$el = el;

    // data
    _.data = proxify(Object.assign({}, options.data, {
        now: function() {
            return Date.now();
        }
    }));

    // directives
    _.directives = Object.assign({
        bind: function(attribute, value) {
            let el = this;

            if (value === undefined || value === null || value === false)
                return this.removeAttribute(attribute);
            if (el.getAttribute(attribute) == value)
                return;

            if (value && Object.prototype.toString.call(value) === '[object Object]') {
                if (attribute == 'style') {
                    Object.keys(value).forEach(function(a) {
                        el.style[a] = value[a];
                    });

                    return;
                }

                value = Object.keys(value).filter((a) => value[a]).join(' ');
            }

            if (this.type && attr == 'checked')
                value = '';

            this.setAttribute(attribute, Array.isArray(value) ? value.join(' ') : value);
        },
        html: function(value) {
            this.innerHTML = value;
        },
        if: function(value) {
            if (!value) {
                let tmp = document.createComment(' tmp ');

                tmp._bindedEl = this;
                tmp._bindedType = 'if';
                this.replaceWith(tmp);
            }
        },
        'else-if': function(value) {
            let prev = previousEl(this);

            if (!prev)
                return;
            if (prev.nodeType != 8 || prev._bindedPrev || !value) {
                let tmp = document.createComment(' tmp ');

                tmp._bindedEl = this;
                tmp._bindedType = 'elseif';
                tmp._bindedPrev = prev._bindedPrev || prev.nodeType != 8;
                this.replaceWith(tmp);
            }
        },
        else: function() {
            let prev = previousEl(this),
                active = true;

            if (!prev)
                return;
            if (prev.nodeType != 8 || prev._bindedPrev) {
                active = false;
            } else if (prev._bindedEl._bindedAttributes.filter((a) => a.name == _.opts.prefix + '-else-if').length) {
                prev = previousEl(prev);

                if (prev && prev.nodeType != 8)
                    active = false;
            }
            if (!active) {
                let tmp = document.createComment(' tmp ');

                tmp._bindedEl = this;
                this.replaceWith(tmp);
            }
        },
        for: function(value) {
            let el = this,
                tmp = el,
                prevEls = (tmp._bindedEls || []).concat();

            if (el.nodeType != 8) {
                tmp = document.createComment(' tmp ');
                tmp._bindedTarget = el.cloneNode(true);
                tmp._bindedValue = el.getAttribute(_.opts.prefix + '-for');
                tmp._bindedEls = [];
                el.before(tmp);
                el.remove();
            } else {
                tmp._bindedEls = [];
            }

            if (Array.isArray(value.list) || (typeof value.list == 'object' && value.list !== null)) {
                let isArray = Array.isArray(value.list);

                (isArray ? value.list : Object.keys(value.list)).forEach(function(item, i, arr) {
                    let val = isArray ? item : value.list[item],
                        scope = {
                            loop: {
                                index: i,
                                first: i == 0,
                                last: i == arr.length - 1,
                                length: arr.length
                            }
                        };

                    value.params.forEach((a, x) => {
                        switch (x) {
                            case 0:
                                scope[a] = isArray ? item : value.list[item];
                                break;
                            case 1:
                                scope[a] = isArray ? i : item;
                                break;
                            case 2:
                                scope[a] = i;
                        }
                    });

                    if (prevEls[i] && prevEls[i]._bindedVal === val) {
                        prevEls[i]._bindedScope = scope;
                        tmp._bindedEls.push(prevEls[i]);
                        return;
                    }

                    let newEl = tmp._bindedTarget.cloneNode(true);

                    newEl._bindedVal = val;
                    newEl._bindedScope = scope;
                    newEl.removeAttribute(_.opts.prefix + '-for');
                    (tmp._bindedEls.length ? tmp._bindedEls[tmp._bindedEls.length - 1] : tmp).after(newEl);

                    tmp._bindedEls.push(newEl);
                });
            }

            prevEls.forEach((a) => {
                if (tmp._bindedEls.indexOf(a) == -1)
                    a.remove();
            });

            traverse(tmp._bindedEls);
        },
        model: function(value, name) {
            switch (this.nodeName.toLowerCase()) {
                case 'input':
                case 'textarea':
                    switch (this.type) {
                        case 'checkbox':
                            if (typeof _.data[name] == 'undefined') {
                                let inputs = findModels(name, 'input[type="checkbox"]'),
                                    checkedInput = inputs.filter((a) => a.checked)[0];

                                if (inputs.length > 1)
                                    _.data[name] = checkedInput ? [checkedInput.value] : [];
                                else
                                    _.data[name] = checkedInput ? true : false;
                            }

                            this.checked = Array.isArray(_.data[name]) ? _.data[name].indexOf(this.value) > -1 : _.data[name] == true;

                            if (!this._bindedModel) {
                                this._bindedModel = true;
                                this.addEventListener('change', function() {
                                    let inputs = findModels(name, 'input[type="checkbox"]');

                                    if (Array.isArray(_.data[name]))
                                        _.data[name] = inputs.filter((a) => a.checked).map((a) => a.value);
                                    else
                                        _.data[name] = this.checked == true;
                                });
                            }
                            break;
                        case 'radio':
                            if (typeof _.data[name] == 'undefined') {
                                let checkedInput = findModels(name, 'input[type="radio"]').filter((a) => a.checked)[0];

                                _.data[name] = checkedInput ? checkedInput.value : null;
                            }

                            this.checked = _.data[name] == this.value;

                            if (!this._bindedModel) {
                                this._bindedModel = true;
                                this.addEventListener('change', function() {
                                    let el = this;

                                    findModels(name, 'input[type="radio"]').forEach(function(a) {
                                        a.checkbox = a == el;
                                    });

                                    _.data[name] = this.value;
                                });
                            }
                            break;
                        default:
                            if (typeof _.data[name] == 'undefined')
                                _.data[name] = value || this.value;

                            this.value = _.data[name] || '';

                            if (!this._bindedModel) {
                                this._bindedModel = true;
                                this.addEventListener('input', function() {
                                    _.data[name] = this.value;
                                });
                            }
                    }
                    break;
                case 'select':
                    let el = this;

                    if (typeof _.data[name] == 'undefined')
                        _.data[name] = this.multiple ? Array.from(this.selectedOptions).map((a) => a.getAttribute('value') != null ? a.value : a.text) : this.value;

                    Array.from(this.options).forEach(function(a) {
                        if (el.multiple)
                            a.selected = _.data[name].indexOf(a.value || a.text) > -1;
                        else
                            a.selected = _.data[name] == (a.getAttribute('value') != null ? a.value : a.text);
                    });

                    if (!this._bindedModel) {
                        this._bindedModel = true;
                        this.addEventListener('change', function() {
                            if (this.multiple) {
                                _.data[name] = Array.from(this.selectedOptions).map((a) => a.getAttribute('value') != null ? a.value : a.text);
                            } else {
                                _.data[name] = this.value;
                            }
                        });
                    }
                    break;
            }
        },
        on: function(type, value, attr, scope) {
            if (!this._bindedEvents)
                this._bindedEvents = {};
            if (this._bindedEvents[type])
                return;
            else {
                this._bindedEvents[type] = true;
                this.addEventListener(type, function(e) {
                    this._bindedEvent = true;
                    parseMethod(value, this, scope, [e]);
                });
            }
        },
        show: function(value) {
            if (!value)
                this.style.display = 'none';
            else if (getComputedStyle(this).display === 'none')
                this.style.display = 'block';
        },
        text: function(value) {
            this.innerText = value;
        }
    }, options.directives);

    // methods
    _.methods = Object.assign({}, options.methods);

    // filters
    _.filters = Object.assign({
        abs: function() {
            return Math.abs(this)
        },
        capitalize: function() {
            let s = this + '';

            return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
        },
        date: function date(n) {
            function t(n, t) {
                return f[n] ? f[n]() : t
            }

            function r(n, t) {
                for (n = String(n); n.length < t;) n = "0" + n;
                return n
            }
            var u, e, o, i = Math.floor(this / 1e3),
                c = ["Sun", "Mon", "Tues", "Wednes", "Thurs", "Fri", "Satur", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
                a = /\\?(.?)/gi,
                f = {
                    d: function() {
                        return r(f.j(), 2)
                    },
                    D: function() {
                        return f.l().slice(0, 3)
                    },
                    j: function() {
                        return u.getDate()
                    },
                    l: function() {
                        return c[f.w()] + "day"
                    },
                    N: function() {
                        return f.w() || 7
                    },
                    S: function() {
                        var n = f.j(),
                            t = n % 10;
                        return t <= 3 && 1 === parseInt(n % 100 / 10, 10) && (t = 0), ["st", "nd", "rd"][t - 1] || "th"
                    },
                    w: function() {
                        return u.getDay()
                    },
                    z: function() {
                        var n = new Date(f.Y(), f.n() - 1, f.j()),
                            t = new Date(f.Y(), 0, 1);
                        return Math.round((n - t) / 864e5)
                    },
                    W: function() {
                        var n = new Date(f.Y(), f.n() - 1, f.j() - f.N() + 3),
                            t = new Date(n.getFullYear(), 0, 4);
                        return r(1 + Math.round((n - t) / 864e5 / 7), 2)
                    },
                    F: function() {
                        return c[6 + f.n()]
                    },
                    m: function() {
                        return r(f.n(), 2)
                    },
                    M: function() {
                        return f.F().slice(0, 3)
                    },
                    n: function() {
                        return u.getMonth() + 1
                    },
                    t: function() {
                        return new Date(f.Y(), f.n(), 0).getDate()
                    },
                    L: function() {
                        var n = f.Y();
                        return n % 4 == 0 & n % 100 != 0 | n % 400 == 0
                    },
                    o: function() {
                        var n = f.n(),
                            t = f.W();
                        return f.Y() + (12 === n && t < 9 ? 1 : 1 === n && 9 < t ? -1 : 0)
                    },
                    Y: function() {
                        return u.getFullYear()
                    },
                    y: function() {
                        return f.Y().toString().slice(-2)
                    },
                    a: function() {
                        return 11 < u.getHours() ? "pm" : "am"
                    },
                    A: function() {
                        return f.a().toUpperCase()
                    },
                    B: function() {
                        var n = 3600 * u.getUTCHours(),
                            t = 60 * u.getUTCMinutes(),
                            e = u.getUTCSeconds();
                        return r(Math.floor((n + t + e + 3600) / 86.4) % 1e3, 3)
                    },
                    g: function() {
                        return f.G() % 12 || 12
                    },
                    G: function() {
                        return u.getHours()
                    },
                    h: function() {
                        return r(f.g(), 2)
                    },
                    H: function() {
                        return r(f.G(), 2)
                    },
                    i: function() {
                        return r(u.getMinutes(), 2)
                    },
                    s: function() {
                        return r(u.getSeconds(), 2)
                    },
                    u: function() {
                        return r(1e3 * u.getMilliseconds(), 6)
                    },
                    e: function() {
                        throw new Error("Not supported (see source code of date() for timezone on how to add support)")
                    },
                    I: function() {
                        return new Date(f.Y(), 0) - Date.UTC(f.Y(), 0) != new Date(f.Y(), 6) - Date.UTC(f.Y(), 6) ? 1 : 0
                    },
                    O: function() {
                        var n = u.getTimezoneOffset(),
                            t = Math.abs(n);
                        return (0 < n ? "-" : "+") + r(100 * Math.floor(t / 60) + t % 60, 4)
                    },
                    P: function() {
                        var n = f.O();
                        return n.substr(0, 3) + ":" + n.substr(3, 2)
                    },
                    T: function() {
                        return "UTC"
                    },
                    Z: function() {
                        return 60 * -u.getTimezoneOffset()
                    },
                    c: function() {
                        return "Y-m-d\\TH:i:sP".replace(a, t)
                    },
                    r: function() {
                        return "D, d M Y H:i:s O".replace(a, t)
                    },
                    U: function() {
                        return u / 1e3 | 0
                    }
                };

            if (!n)
                n = 'r';

            return e = n, u = void 0 === (o = i) ? new Date : o instanceof Date ? new Date(o) : new Date(1e3 * o), e.replace(a, t)
        },
        first: function() {
            return this[0]
        },
        floor: function() {
            return Math.floor(this)
        },
        join: function(s) {
            return Array.isArray(this) ? this.join(typeof s == 'undefined' ? ', ' : s) : ''
        },
        json_encode: function() {
            return JSON.stringify(this)
        },
        last: function() {
            return this[this.length - 1]
        },
        length: function() {
            if (this.length)
                return this.length;
            if (this && typeof this == 'object')
                return Object.keys(this).length;

            return 0;
        },
        lower: function() {
            return (this + '').toLowerCase()
        },
        number_format: function(t, n, i) {
            let e = (this + "").replace(/[^0-9+\-Ee.]/g, "");
            e = isFinite(+e) ? +e : 0, t = isFinite(+t) ? Math.abs(t) : 0, i = void 0 === i ? "," : i, n = void 0 === n ? "." : n;
            let r = "";
            return r = (t ? function(t, n) {
                if (-1 === ("" + t).indexOf("e")) return +(Math.round(t + "e+" + n) + "e-" + n); {
                    t = ("" + t).split("e");
                    let e = "";
                    return 0 < +t[1] + n && (e = "+"), (+(Math.round(+t[0] + "e" + e + (+t[1] + n)) + "e-" + n)).toFixed(n)
                }
            }(e, t).toString() : "" + Math.round(e)).split("."), 3 < r[0].length && (r[0] = r[0].replace(/\B(?=(?:\d{3})+(?!\d))/g, i)), (r[1] || "").length < t && (r[1] = r[1] || "", r[1] += new Array(t - r[1].length + 1).join("0")), r.join(n)
        },
        replace: function(f, m) {
            return (this + '').replaceAll(f, m)
        },
        reverse: function() {
            return this.reverse()
        },
        round: function() {
            return Math.round(this)
        },
        slice: function(s, e) {
            return this.slice(s, e)
        },
        split: function(s) {
            return (this + '').split(s || '');
        },
        sort: function() {
            return this.sort();
        },
        title: function() {
            return this.split(' ').map((s) => {
                return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
            }).join(' ');
        },
        trim: function() {
            return (this + '').trim()
        },
        upper: function() {
            return (this + '').toUpperCase()
        },
        url_encode: function() {
            return encodeURIComponent(this)
        }
    }, options.filters);

    _.update = function(el) {
        build(el);
    };

    // private variables
    const invalidTextSyntax = ['var', 'const', 'let', 'eval', '=', '+=', '-=', '++', '--'];
    const invalidFunctions = ['pop', 'push', 'reduce', 'reverse', 'shift', 'slice', 'sort', 'unshift', 'freeze', 'seal', 'setPrototypeOf'];
    const emptyObject = {};

    // build
    build();
    _.$el.removeAttribute(_.opts.prefix +'-cloak');
    options.onReady ? options.onReady(_.$el) : null;

    /* private functions */
    function build(el) {
        traverse(el || _.$el);
        options.onRender ? options.onRender(el || _.$el) : null;
    }

    function onChange(object, name, value, old) {
        build();
        options.onChange ? options.onChange(_.$el, object, name, value, old) : null;
    }

    function traverse(node) {
        if (node.nodeName === 'SCRIPT' || node.nodeName === 'STYLE')
            return;

        let children = Array.isArray(node) ? node.concat() : Array.from(node.childNodes);

        while (children.length) {
            let a = children[0];

            if (a.nodeType == 1) {
                let attrs = a._bindedAttributes || Array.from(a.attributes),
                    hasChildren = a.childNodes.length;

                for (let i = 0; i < attrs.length; i++) {
                    let attr = attrs[i],
                        name = attr.name;

                    if (name.indexOf(':') == 0)
                        name = _.opts.prefix + '-bind' + name;
                    if (name.indexOf('@') == 0)
                        name = _.opts.prefix + '-on:' + name.substr(1);
                    if (name.indexOf(_.opts.prefix + '-') == 0) {
                        if (name == _.opts.prefix +'-cloak') {
                            a.removeAttribute(name);
                            continue;
                        }
                        if (!a._bindedAttributes)
                            a._bindedAttributes = [];
                        if (a._bindedAttributes.indexOf(attr) == -1)
                            a._bindedAttributes.push(attr);
                        if (name == _.opts.prefix +'-ignore') {
                            hasChildren = 0;
                            a.removeAttribute(name);
                            continue;
                        }

                        attribute(a, name.substr(2), attr.value, findScope(a));
                        a.removeAttribute(attr.name);
                    }
                }

                if (hasChildren)
                    traverse(a);
            } else if (a.nodeType == 3) {
                if (a._bindedValue || a.nodeValue.match(new RegExp('\\'+_.opts.delimiters[0]+'.*?\\' + _.opts.delimiters[1]))) {
                    let parser = text(a._bindedValue || a.nodeValue, findScope(a));

                    if (!a._bindedValue)
                        a._bindedValue = a.nodeValue;
                    a.nodeValue = parser;
                }
            } else if (a.nodeType == 8) {
                if (a._bindedEl) {
                    a.replaceWith(a._bindedEl);
                    children.splice(1, 0, a._bindedEl);
                } else if (a._bindedTarget) {
                    attribute(a, 'for', a._bindedValue, findScope(a));
                }
            }

            children.splice(0, 1);
        };
    };

    function text(content, scope) {
        let groups = content.match(new RegExp('\\'+_.opts.delimiters[0]+'.*?\\' + _.opts.delimiters[1], 'g'));

        for (let i = 0; i < groups.length; i++) {
            var g = new RegExp('\\'+_.opts.delimiters[0]+'(.*?)\\' + _.opts.delimiters[1], 'g').exec(content);

            if (g) {
                let val = parseText(g[1].trim(), scope);

                content = content.replace(g[0], val != undefined ? val.toString ? val.toString() : val : '');
            }
        }

        return content;
    }

    function attribute(el, name, value, scope) {
        let val = value;

        if (name.indexOf(':') > -1) {
            let directive = name.split(':');

            if (!_.directives[directive[0]])
                return;

            if (directive[0] != 'on')
                val = parseText(value, scope);

            _.directives[directive[0]].call(el, directive[1], val, value, scope);
        } else if (_.directives[name]) {
            if (name == 'for')
                val = parseFor(value, scope);
            else
                val = parseText(value, scope);

            _.directives[name].call(el, val, value, scope);
        }
    }

    function findModels(name, selector = '*') {
        return Array.from(_.$el.querySelectorAll(selector)).filter((a) => a._bindedAttributes ? a._bindedAttributes.filter((b) => b.name == _.opts.prefix + '-model' && b.value == name).length : a.getAttribute(_.opts.prefix + '-model') == name);
    }

    function proxify(object) {
        let proxy;

        if (object instanceof Date) {
            return object;
        } else {
            proxy = new Proxy(object, {
                set: function(object, name, value) {
                    let old = object[name];

                    if (name.substr(0, 1) == '_')
                        return true;
                    if (value === old)
                        return true;
                    if (value && typeof value == 'object')
                        value = proxify(value);

                    object[name] = value;
                    onChange(object, name, value, old);

                    return true;
                },
                deleteProperty: function(object, name) {
                    let old = object[name];

                    if (name.substr(0, 1) == '_')
                        return true;
                    if (typeof old == 'undefined')
                        return true;

                    delete object[name];
                    onChange(object, name, undefined, old);

                    return true;
                }
            });
        }

        for (var prop in object) {
            if (object.hasOwnProperty(prop) && object[prop] && typeof object[prop] == 'object')
                object[prop] = proxify(object[prop]);
        }

        return proxy;
    }

    function parseText(text, scope) {
        return splitTextParts(text, scope);
    }

    function parseMethod(content, el, scope, properties) {
        let parts = content.match(/(.*?)($|\(.*?\))/),
            method = parts[1].trim(),
            args = parts[2] ? parts[2].substr(1, parts[2].length - 2).split(/,(?=(?:(?:[^'"]*(?:'|")){2})*[^'"]*$)/).map((b) => parseTextPart(b.trim(), scope)) : [];

        if (_.methods[method])
            return _.methods[method].apply(el, properties.concat(args));
    }

    function parseFor(content, scope) {
        let parts = content.match(/^(.*?)(?:$| in (.*?))$/),
            list = parseTextPart(parts[2] || parts[1], scope),
            params;

        if (!isNaN(parseFloat(list)))
            list = Array.from(Array(list + 1).keys()).filter((a) => a > 0);

        if (parts[2])
            params = parts[1].includes(',') ? parts[1].substr(1, parts[1].length - 2).split(',').map((a) => a.trim()) : [parts[1].trim()];
        else
            params = [];

        return { list, params };
    }

    function splitTextParts(text, scope) {
        let ignoreParts = [],
            parts = text.split(/(\+|-|\*|\*\*|\/|%|==|===|\!=|\!==|>|<|>=|<=|\?|:|&&|\|\||\{|\})/).map(function(part, index, arr) {
                if (((part.indexOf('"') > -1 && part.split('"').length == 2) || part.indexOf("'") > -1 && part.split("'").length == 2) && arr.length >= index + 2) {
                    arr[index + 1] = part + arr[index + 1];
                    return '';
                }
                if (index % 2)
                    return part;
                if (part.split('(').length != part.split(')').length && arr.length >= index + 3) {
                    arr[index + 2] = part.replace(part.replace('(', ''), '__$arr['+ index +']') + arr[index + 1] + arr[index + 2];
                    ignoreParts.push(index, index + 1);
                    return arr[index] = parseTextPart(part.replace('(', ''), scope);
                }

                let complex = part.match(/\((.*[^\(])\)/),
                    complexIsFilter = false;

                if (complex) {
                    part.split('|').forEach((a, i) => {
                        if (a.indexOf(complex[0]) > -1 && i)
                            complexIsFilter = true;
                    });

                    if (!complexIsFilter) {
                        let complexPart = splitTextParts(complex[1], Object.assign(scope || {}, {__$arr: arr}));

                        if ((complexPart+'').length > 0)
                            return parseTextPart(part.replace(complex[1], parseValue(complexPart, true)), scope, true);

                        return complexPart;
                    }
                }

                return parseTextPart(part.trim(), scope, true);
            });

        let result = '';

        try {
            result = new Function('return ' + parts.filter((v, i) => v !== undefined && ignoreParts.indexOf(i) === -1).join(''))();
        } catch (e) {}

        return result !== undefined && (result.toString ? result.toString() != 'NaN' : true) ? result : '';
    }

    function parseTextPart(part, scope, escape) {
        let parts = part.match(/^(.*?)(?:|\|(.*?))$/),
            property = parts[1].trim(),
            filters = parts[2] ? parts[2].trim() : null,
            value = evalText(property, scope);

        if (value !== undefined) {
            if (filters) {
                filters.split('|').map(function(a) {
                    let p = a.match(/(.*?)($|\(.*?\))/),
                    filter = p[1].trim(),
                    args = p[2] ? p[2].substr(1, p[2].length - 2).split(/,(?=(?:(?:[^'"]*(?:'|")){2})*[^'"]*$)/).map((b) => parseTextPart(b.trim(), scope)) : [];

                    if (_.filters[filter])
                        value = _.filters[filter].apply(value, args);
                    else if (typeof val == 'string' && String.prototype[filter])
                        value = String.prototype[filter].apply(value, args);
                });
            }

            if (escape)
                value = parseValue(value, true);
        }

        return value;
    }

    function evalText(text, scope) {
        try {
            let ref;

            try {
                ref = new Function('_scope', 'return _scope.' + text)(scope);
            } catch (e) {}
            if (ref == undefined)
                try {
                    let fn = text.split('(').shift();

                    ref = new Function('_', 'return _.data.' + fn + '.toString().indexOf("[native code]") > -1 && ' + (invalidFunctions.indexOf(fn.split('.').pop()) > -1) + ' ? undefined : _.data.' + text)(_);
                } catch (e) {}

            if (ref == undefined)
                throw '';

            return parseValue(ref);
        } catch(e) {
            try {
                if (!text.match(/^(?:['"]).*?(?:['"])$/) && text.match(/=|\+=|-=|\+\+|--|\w+\(/))
                    return undefined;

                return new Function('return ' + text)();
            } catch(e) {
                return undefined;
            }
        }
    }

    function parseValue(val, escape) {
        let stringQuotes = ['"', "'"];

        if (val == 'null')
            return null;
        else if (val == 'undefined')
            return undefined;
        else if (!isNaN(parseFloat(val)))
            return parseFloat(val);
        else if (typeof val == 'string') {
            if (!val.length)
                return val;
            if (val == '""' || val == "''")
                return "''";
            if (val.indexOf('__$arr') === 0)
                return val;
            if (stringQuotes.indexOf(val[0]) > -1 && (stringQuotes.indexOf(val[val.length - 1]) > -1))
                return val;
            if (!escape && invalidTextSyntax.filter((a) => val.indexOf(a) > -1).length)
                return ' %i%n ';
            if (escape)
                return "'" + (val).replace(/'/g, "\\'") + "'";
            return val;
        } else if (val.concat)
            return val.concat();
        else if (val.defineProperty)
            return Object.assign({}, val);

        return val;
    }

    function findScope(node) {
        if (!node || node == _.$el)
            return undefined;
        if (node._bindedScope)
            return node._bindedScope;

        return node.parentNode ? findScope(node.parentNode) : undefined;
    }

    function previousEl(node) {
        let prev;

        while (!prev) {
            node = node.previousSibling;

            if (!node || node == _.$el)
                return null;
            if (node.nodeType == 1 || (node.nodeType == 8 && node._bindedEl))
                prev = node;
        }

        return prev;
    }
};
