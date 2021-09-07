# Binder.js

> Lightweight and powerful data binding system for building user interfaces

A perfect solution for really small projects. It will boost your productivity with < 15Kb script without downloading and compiling a huge amount of code.

__[Documentation](https://codepen.io/onesideat/pen/YzQNyvb) | [Example](https://codepen.io/onesideat/pen/YzQNyvb)__

### Installation
Download and link the binder.min.js into your HTML page.

~~~html
<script src="binder.min.js"></script>
~~~

### Quick Start
**HTML**
~~~html
<div id="app">
    {{ message }}
</div>
~~~

**JavaScript**
~~~js
var app = new Binder(document.getElementById('app'), {
    data: {
	message: 'Hello World'
    }
});
~~~

Continue with the [template syntax](template.md) part or with [options](options.md) properties.

#### Inspired by:
- Vue.js
- Rivets.js
- Twig

### License
This project is licensed under the MIT license.
