# Third-party notices

This plugin's published package contains only its compiled bundle (`dist/`).
The bundle embeds the following third-party software and artwork. Angular,
RxJS, `ngx-toastr`, `@ng-bootstrap/ng-bootstrap` and the `tabby-*` packages
are *not* redistributed by this plugin — they are declared as webpack
externals and provided at runtime by Tabby itself.

## js-yaml

The plugin reads Tabby's `config.yaml` through
[js-yaml](https://github.com/nodeca/js-yaml), which is bundled in full into
`dist/index.js`. Its license is reproduced here because the minified bundle
does not preserve it:

```
(The MIT License)

Copyright (C) 2011-2015 by Vitaly Puzrin

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
```

## pug-runtime

The plugin's component templates are compiled from Pug at build time; the
small [pug-runtime](https://github.com/pugjs/pug) helper library (part of the
Pug project, Copyright (c) 2014 Forbes Lindesay), licensed under the MIT
License, is inlined into `dist/index.js` by `pug-loader`.

## css-loader runtime

The plugin's stylesheets are processed at build time by
[css-loader](https://github.com/webpack-contrib/css-loader) (Copyright JS
Foundation and other contributors), licensed under the MIT License. Its small
runtime helpers (`api.js`, `getUrl.js`, `sourceMaps.js`) are inlined into
`dist/index.js`.

## style-loader runtime

Styles are injected into the page by the runtime helpers of
[style-loader](https://github.com/webpack-contrib/style-loader) (Copyright JS
Foundation and other contributors), licensed under the MIT License
(`injectStylesIntoStyleTag.js`, `styleDomAPI.js`, `insertBySelector.js`,
`setAttributesWithoutAttributes.js`, `insertStyleElement.js`,
`styleTagTransform.js`), inlined into `dist/index.js`.

## Font Awesome icon artwork

The notification style (`src/toast.scss`) embeds, as an inline SVG data URI,
the path of the `info-circle` icon from
[Font Awesome Free](https://fontawesome.com) (icons: CC BY 4.0, code: MIT),
recolored to white so it stays legible on the notification's red background.
Only that single recolored vector path is embedded — no Font Awesome font
files, CSS or other glyphs are redistributed by this plugin.
