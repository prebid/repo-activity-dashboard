import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import ts from 'typescript';
import { z } from 'zod';

// Visual values come from src/styles/prebid.css; every other file reaches them through var().
// Supported grammar:
// - CSS: every declaration under src/ (custom properties included) and @apply utilities. In
//   prebid.css only the custom properties directly in the top-level :root and .dark rules, which
//   define the tokens, may hold literals.
// - TSX/TS: className and *ClassName attributes and properties, cn/clsx/cva/twMerge arguments,
//   style and *Style objects, fill/stroke/color/stopColor/fontSize/fontFamily/rx/ry/radius
//   attributes, object-literal attribute values, and colour literals in any other string literal.
// - Token names: a literal var(--prebid-*) in a CSS value or a TSX/TS string, and Tailwind's
//   prefix-(--prebid-*) in a class string, must name a token prebid.css defines. A name that an
//   interpolation completes (`var(--prebid-text-${role})`) is not read.
// - Text arrows: in TSX/TS under src/, a string, template part or JSX text holding a U+2190-U+21FF
//   character (escapes are read as the character), or JSX text or a JSX attribute string holding
//   a numeric character reference in that range or a named one containing "arr" (&larr;). Arrows
//   chosen by a conditional, a logical operand or a concatenation form one site keyed by that
//   expression. Comments, regular expressions, other named references (&lharu;) and characters
//   built at run time (String.fromCharCode) are not read.
// - Control overrides: in CSS modules outside src/components/ui/ and src/styles/, a declaration of
//   a height or block size (min-, max- included), any background or border property except
//   border-radius, box-shadow, font or font-size whose selector reaches a button, input, select,
//   summary or textarea through a descendant or child combinator (`.bar button:hover`,
//   `.field > input::placeholder`); nested rules are resolved against their parents. Unlayered
//   feature CSS beats the primitives' layered utilities, so such a rule silently replaces the
//   primitive's appearance. A control matched by its own class, by an attribute alone
//   (`.bar [type='checkbox']`), by a sibling combinator, or only inside :global(), :is() or
//   :where() is not read.
// Values that cannot be read statically (style={identifier}, a class value that is an identifier
// or a call, interpolated class names) are listed under `unmodelled` instead of passing silently,
// and the scan fails when there are more of them than `unmodelledCeiling`.

const repository = fileURLToPath(new URL('../', import.meta.url));
export const defaultAllowlist = 'scripts/design-token-allowlist.json';
const tokenFile = 'src/styles/prebid.css';
const mappingFile = 'src/app/globals.css';
const phases = ['P2', 'P3', 'P4'];
/** Phases already merged; an allowlist entry owned by one fails. @type {readonly string[]} */
export const completedPhases = Object.freeze(['P1', 'P2', 'P3']);
/** The unmodelled sites in the tree today; lowered as values become readable or are removed. */
export const unmodelledCeiling = 68;
/** @param {string} list space-separated words */
const words = (list) => list.split(' ');
const keywords = new Set(words('inherit initial unset revert revert-layer'));
const genericFamilies = new Set(
  words('ui-sans-serif system-ui sans-serif ui-monospace monospace sfmono-regular menlo consolas'),
);
const fontKeywords = new Set(
  words(
    'normal italic oblique bold bolder lighter small-caps ultra-condensed extra-condensed ' +
      'condensed semi-condensed semi-expanded expanded extra-expanded ultra-expanded',
  ),
);
const colourFunctions = new Set(words('rgb rgba hsl hsla hwb lab lch oklab oklch color color-mix'));
const mathFunctions = new Set(['', 'calc', 'min', 'max', 'clamp']);
const namedColours = new Set(
  words(
    'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue ' +
      'blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk ' +
      'crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki ' +
      'darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen ' +
      'darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue ' +
      'dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite ' +
      'gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki ' +
      'lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan ' +
      'lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen ' +
      'lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen ' +
      'magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen ' +
      'mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream ' +
      'mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid ' +
      'palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum ' +
      'powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown ' +
      'seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen ' +
      'steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen',
  ),
);
const textArrow = /[←-⇿]/;
const characterReference = /&(?:#x([0-9a-f]+)|#(\d+)|([a-z][a-z\d]*));/gi;
const hexColour = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const stringHex = /(?<![\w&#-])#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})(?![\w-])/i;
const stringFunction = /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(/i;
const radiusSides = 't|r|b|l|s|e|tl|tr|br|bl|ss|se|ee|es';
const radiusPrefix = new RegExp(`^rounded(?:-(?:${radiusSides}))?$`);
// Longest first, so border-t-white reads as border-t with white.
const colourPrefixes = words(
  'inset-shadow drop-shadow text-shadow ring-offset placeholder decoration inset-ring border-x ' +
    'border-y border-s border-e border-t border-r border-b border-l outline border accent divide ' +
    'shadow stroke caret fill from ring text via bg to',
).sort((a, b) => b.length - a.length);
/** @type {[RegExp, string, string][]} The first pattern that matches decides the namespace. */
const namespaces = [
  [/^inset-shadow(?:-(.+))?$/, '--inset-shadow', 'shadow utility'],
  [/^drop-shadow(?:-(.+))?$/, '--drop-shadow', 'shadow utility'],
  [/^text-shadow(?:-(.+))?$/, '--text-shadow', 'shadow utility'],
  [/^shadow(?:-(.+))?$/, '--shadow', 'shadow utility'],
  [/^text-(.+)$/, '--text', 'text size utility'],
  [new RegExp(`^rounded(?:-(?:${radiusSides}))?(?:-(.+))?$`), '--radius', 'radius utility'],
  [/^font-(.+)$/, '--font', 'font-family utility'],
];
const helpers = new Set(['cn', 'clsx', 'cva', 'twMerge']);
const controlElements = new Set(words('button input select summary textarea'));
/**
 * Size, fill, edge, shadow and text properties; border-radius shapes a control without restyling it.
 * @param {string} property
 */
function restylesControlProperty(property) {
  return (
    /^(?:min-|max-)?(?:height|block-size)$/.test(property) ||
    /^background(?:-|$)/.test(property) ||
    (/^border(?:-|$)/.test(property) && !property.endsWith('radius')) ||
    property === 'box-shadow' ||
    property === 'font' ||
    property === 'font-size'
  );
}
/** JSX attributes that are checked as the CSS property they set. */
const attributeProperties = new Map([
  ['fill', 'fill'],
  ['stroke', 'stroke'],
  ['color', 'color'],
  ['stopColor', 'stop-color'],
  ['fontSize', 'font-size'],
  ['fontFamily', 'font-family'],
  ['rx', 'border-radius'],
  ['ry', 'border-radius'],
  ['radius', 'border-radius'],
]);
/** @type {Read} */
const readVariables = { variables: true, shorthand: false };
/** @type {Read} */
const readShorthand = { variables: false, shorthand: true };
/** @type {Read} */
const readBoth = { variables: true, shorthand: true };

const allowlistSchema = z
  .object({
    version: z.literal(1),
    entries: z.array(
      z
        .object({
          file: z.string(),
          context: z.string(),
          selector: z.string(),
          property: z.string(),
          value: z.string(),
          phase: z.string(),
          reason: z.string(),
        })
        .strict(),
    ),
  })
  .strict();

/**
 * @typedef {{ type: 'word' | 'string' | 'operator', value: string }} PlainToken
 * @typedef {{ type: 'number', value: string, unit: string }} NumberToken
 * @typedef {{ type: 'function', value: string, raw: string, closed: boolean, nodes: Token[] }} FunctionToken
 * @typedef {PlainToken | NumberToken | FunctionToken} Token
 * @typedef {{ file: string, context: string, selector: string, property: string, value: string }} Key
 * @typedef {Key & { line: number, rules: string[] }} Site
 * @typedef {Key & { phase: string, reason: string }} Entry
 * @typedef {{ defaults: Set<string>, mapped: Set<string>, defaultColours: Set<string>, projectColours: Set<string>, tokens: Set<string> }} Theme
 * @typedef {{ variables: boolean, shorthand: boolean }} Read which token references to read:
 *   var(--name), and Tailwind's prefix-(--name) and prefix-(type:--name) class shorthand
 */

/**
 * @param {string} text
 * @param {number} open index of '('
 */
function closingParen(text, open) {
  let depth = 0;
  for (let index = open; index < text.length; index++) {
    const char = text[index];
    if (char === '"' || char === "'") {
      index++;
      while (index < text.length && text[index] !== char) index += text[index] === '\\' ? 2 : 1;
    } else if (char === '(') depth++;
    else if (char === ')' && --depth === 0) return index;
  }
  return text.length;
}

/**
 * A CSS value split into words, numbers, strings, operators and functions with their arguments.
 * @param {string} text
 * @returns {Token[]}
 */
function tokenize(text) {
  /** @type {Token[]} */
  const tokens = [];
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (/\s/.test(char)) {
      index++;
      continue;
    }
    if (char === '"' || char === "'") {
      let end = index + 1;
      while (end < text.length && text[end] !== char) end += text[end] === '\\' ? 2 : 1;
      tokens.push({ type: 'string', value: text.slice(index + 1, end) });
      index = end + 1;
      continue;
    }
    const rest = text.slice(index);
    const number = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i.exec(rest);
    if (number) {
      const unit = /^(?:%|[a-z]+)/i.exec(rest.slice(number[0].length))?.[0] ?? '';
      tokens.push({ type: 'number', value: number[0], unit: unit.toLowerCase() });
      index += number[0].length + unit.length;
      continue;
    }
    const word = /^(?:#[\w-]*|-{0,2}[a-z_][\w-]*)/i.exec(rest)?.[0];
    if (char === '(' || (word && !word.startsWith('#') && text[index + word.length] === '(')) {
      const open = index + (char === '(' ? 0 : (word ?? '').length);
      const close = closingParen(text, open);
      const name = char === '(' ? '' : (word ?? '').toLowerCase();
      tokens.push({
        type: 'function',
        value: name,
        raw: text.slice(index, close + 1),
        closed: close < text.length,
        nodes: name === 'url' ? [] : tokenize(text.slice(open + 1, close)),
      });
      index = close + 1;
      continue;
    }
    if (word) {
      tokens.push({ type: 'word', value: word });
      index += word.length;
      continue;
    }
    tokens.push({ type: 'operator', value: char });
    index++;
  }
  return tokens;
}

/**
 * @param {Token[]} tokens
 * @param {boolean} names whether CSS colour keywords count (only in colour-bearing properties)
 * @returns {boolean}
 */
function hasColourLiteral(tokens, names) {
  for (const token of tokens) {
    if (token.type === 'function') {
      if (colourFunctions.has(token.value) || hasColourLiteral(token.nodes, names)) return true;
    } else if (token.type === 'word') {
      if (hexColour.test(token.value)) return true;
      if (names && namedColours.has(token.value.toLowerCase())) return true;
    }
  }
  return false;
}

/**
 * True when a value holds anything other than var() references, math over them, operators and
 * the tokens `allowed` accepts.
 * @param {Token[]} tokens
 * @param {(token: Token) => boolean} allowed
 * @returns {boolean}
 */
function hasLiteral(tokens, allowed) {
  for (const token of tokens) {
    if (allowed(token) || token.type === 'operator') continue;
    if (token.type !== 'function') return true;
    if (token.value === 'var') {
      // Only a fallback after the first comma can carry a literal.
      const comma = token.nodes.findIndex((node) => node.type === 'operator' && node.value === ',');
      if (comma >= 0 && hasLiteral(token.nodes.slice(comma + 1), allowed)) return true;
    } else if (!mathFunctions.has(token.value) || hasLiteral(token.nodes, allowed)) return true;
  }
  return false;
}

/** @param {Token} token */
function isKeyword(token) {
  return token.type === 'word' && keywords.has(token.value.toLowerCase());
}

/**
 * A shadow passes as `none`, a CSS-wide keyword, or a list of bare var() references.
 * @param {Token[]} tokens
 * @returns {boolean}
 */
function hasShadowLiteral(tokens) {
  /** @type {Token[][]} */
  const layers = [[]];
  for (const token of tokens)
    if (token.type === 'operator' && token.value === ',') layers.push([]);
    else layers[layers.length - 1].push(token);
  return layers.some((layer) => {
    if (layer.length !== 1) return true;
    const [token] = layer;
    if (token.type === 'word') return token.value.toLowerCase() !== 'none' && !isKeyword(token);
    if (token.type !== 'function' || token.value !== 'var') return true;
    const comma = token.nodes.findIndex((node) => node.type === 'operator' && node.value === ',');
    return comma >= 0 && hasShadowLiteral(token.nodes.slice(comma + 1));
  });
}

/**
 * The --prebid- names a value reads. A name that ends the text inside an unclosed function is
 * where a template piece stops, so an interpolation may complete it; it is not read.
 * @param {Token[]} tokens
 * @param {Read} read
 * @param {string[]} [names]
 * @returns {string[]}
 */
function tokenReferences(tokens, read, names = []) {
  for (const token of tokens) {
    if (token.type !== 'function') continue;
    const [first, second, third] = token.nodes;
    /** @type {Token | undefined} */
    let name;
    if (token.value === 'var') {
      if (read.variables) name = first;
    } else if (read.shorthand && token.value.endsWith('-'))
      name = second?.type === 'operator' && second.value === ':' ? third : first;
    if (
      name?.type === 'word' &&
      name.value.startsWith('--prebid-') &&
      (token.closed || token.nodes.at(-1) !== name)
    )
      names.push(name.value);
    tokenReferences(token.nodes, read, names);
  }
  return names;
}

/**
 * Reports each --prebid- name in `text` that prebid.css does not define.
 * @param {string} text
 * @param {Read} read
 * @param {Set<string>} defined
 * @param {() => Key & { line: number }} site called only when there is something to report
 * @param {string[]} failures
 */
function checkReferences(text, read, defined, site, failures) {
  if (!text.includes('--prebid-')) return;
  const missing = tokenReferences(tokenize(text), read).filter((name) => !defined.has(name));
  if (!missing.length) return;
  const at = site();
  for (const name of missing)
    failures.push(`${at.file}:${at.line}: undefined token ${name}: ${describe(at)}`);
}

/**
 * A token definition: a custom property directly in the top-level :root or .dark rule.
 * @param {import('postcss').Declaration} declaration
 */
function isTokenDeclaration(declaration) {
  const rule = declaration.parent;
  return (
    declaration.prop.startsWith('--') &&
    rule?.type === 'rule' &&
    rule.parent?.type === 'root' &&
    [':root', '.dark'].includes(/** @type {import('postcss').Rule} */ (rule).selector.trim())
  );
}

/** @param {string} property lower-case, without a vendor prefix */
function isColourBearing(property) {
  return (
    property.endsWith('color') ||
    /^(?:background(?:-image)?|border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?|outline|text-decoration|text-emphasis|column-rule|box-shadow|text-shadow|fill|stroke)$/.test(
      property,
    )
  );
}

/** @param {string} property */
function normaliseProperty(property) {
  return property.startsWith('--')
    ? property
    : property.toLowerCase().replace(/^-(?:webkit|moz|ms|o)-/, '');
}

/**
 * The value check a property needs, if any. Theme custom properties are read by their
 * Tailwind namespace, because a literal there reaches every utility built on it.
 * @param {string} property normalised
 * @param {boolean} theme inside an @theme block
 */
function propertyKind(property, theme) {
  if (property.startsWith('--')) {
    if (!theme) return undefined;
    if (/^--(?:inset-shadow|drop-shadow|text-shadow|shadow)(?:-|$)/.test(property))
      return 'box-shadow';
    if (/^--text-(?!.*--)/.test(property)) return 'font-size';
    if (/^--font-(?!weight-)(?!.*--)/.test(property)) return 'font-family';
    if (/^--radius(?:-|$)/.test(property)) return 'border-radius';
    return undefined;
  }
  if (property === 'font-size' || property === 'font-family' || property === 'font')
    return property;
  if (property === 'box-shadow') return property;
  if (/^border(?:-[a-z]+)*-radius$/.test(property)) return 'border-radius';
  return undefined;
}

/** @param {string} property normalised */
function isVisualProperty(property) {
  return isColourBearing(property) || propertyKind(property, false) !== undefined;
}

/**
 * @param {string} property
 * @param {string} value
 * @param {{ generic?: boolean, theme?: boolean }} [options] generic: generic family names pass
 * @returns {string[]} the failed rules
 */
function declarationRules(property, value, { generic = false, theme = false } = {}) {
  const name = normaliseProperty(property);
  const tokens = tokenize(value);
  const custom = name.startsWith('--');
  /** @type {string[]} */
  const rules = [];
  if (hasColourLiteral(tokens, !custom && isColourBearing(name))) rules.push('colour literal');
  /** @param {Token} token */
  const family = (token) =>
    isKeyword(token) ||
    (generic && token.type === 'word' && genericFamilies.has(token.value.toLowerCase()));
  switch (propertyKind(name, theme)) {
    case 'font-size':
      if (hasLiteral(tokens, isKeyword)) rules.push('font-size literal');
      break;
    case 'font-family':
      if (hasLiteral(tokens, family)) rules.push('font-family literal');
      break;
    case 'font':
      if (
        hasLiteral(
          tokens,
          (token) =>
            family(token) ||
            (token.type === 'number' && token.unit === '') ||
            (token.type === 'word' && fontKeywords.has(token.value.toLowerCase())),
        )
      )
        rules.push('font shorthand literal');
      break;
    case 'box-shadow':
      if (hasShadowLiteral(tokens)) rules.push('box-shadow literal');
      break;
    case 'border-radius':
      if (
        hasLiteral(
          tokens,
          (token) =>
            isKeyword(token) ||
            (token.type === 'number' &&
              (Number(token.value) === 0 || (Number(token.value) === 50 && token.unit === '%'))),
        )
      )
        rules.push('border-radius literal');
      break;
  }
  return rules;
}

/** @param {string} value Tailwind arbitrary value: underscores stand for spaces */
function arbitrary(value) {
  return value.replace(/_/g, ' ');
}

/**
 * The CSS property an arbitrary `prefix-[value]` utility sets, for the literal check.
 * @param {string} prefix
 * @param {string} hint Tailwind type hint such as `length` or `color`
 * @param {string} value
 */
function arbitraryProperty(prefix, hint, value) {
  const [first] = tokenize(value);
  const sized =
    first !== undefined &&
    ((first.type === 'number' && first.unit !== '') ||
      (first.type === 'function' && mathFunctions.has(first.value)));
  if (prefix === 'text') {
    if (hint === 'color') return 'color';
    return ['length', 'absolute-size', 'relative-size', 'percentage'].includes(hint) || sized
      ? 'font-size'
      : 'color';
  }
  if (prefix === 'font') {
    if (hint === 'family-name') return 'font-family';
    return hint || first?.type === 'number' || first?.type === 'function'
      ? 'font-weight'
      : 'font-family';
  }
  if (radiusPrefix.test(prefix)) return 'border-radius';
  if (['shadow', 'inset-shadow', 'drop-shadow', 'text-shadow'].includes(prefix))
    return hint === 'color' ? 'color' : 'box-shadow';
  if (colourPrefixes.includes(prefix)) return 'color';
  return prefix;
}

/**
 * @param {string} token one class name as written
 * @param {Theme} theme
 * @returns {{ rules: string[], value: string } | undefined}
 */
function classRules(token, theme) {
  let depth = 0;
  let start = 0;
  for (let index = 0; index < token.length; index++) {
    const char = token[index];
    if (char === '[' || char === '(') depth++;
    else if (char === ']' || char === ')') depth--;
    else if (char === ':' && depth === 0) start = index + 1;
  }
  const utility = token
    .slice(start)
    .replace(/^!|!$/g, '')
    .replace(/^-(?=[a-z])/, '');
  if (!utility) return undefined;
  if (utility.startsWith('[') && utility.endsWith(']')) {
    const inner = utility.slice(1, -1);
    const colon = inner.indexOf(':');
    if (colon <= 0) return undefined;
    const value = arbitrary(inner.slice(colon + 1));
    const rules = declarationRules(inner.slice(0, colon), value);
    return rules.length
      ? { rules: rules.map((rule) => 'arbitrary ' + rule), value: inner.slice(colon + 1) }
      : undefined;
  }
  const bracket = /^(.+?)-\[(.+)\](?:\/[^/]+)?$/.exec(utility);
  if (bracket) {
    const hinted = /^([a-z][a-z-]*):(.*)$/s.exec(bracket[2]);
    const value = arbitrary(hinted ? hinted[2] : bracket[2]);
    const property = arbitraryProperty(bracket[1], hinted?.[1] ?? '', value);
    const rules = property === 'font-weight' ? [] : declarationRules(property, value);
    return rules.length
      ? { rules: rules.map((rule) => 'arbitrary ' + rule), value: bracket[2] }
      : undefined;
  }
  // prefix-(--name) is Tailwind's shorthand for prefix-[var(--name)].
  if (/-\(.+\)(?:\/[^/]+)?$/.test(utility)) return undefined;
  const base = utility.split('/')[0];
  for (const prefix of colourPrefixes) {
    if (!base.startsWith(prefix + '-')) continue;
    const name = base.slice(prefix.length + 1);
    if (theme.projectColours.has(name)) return undefined;
    if (theme.defaultColours.has(name)) return { rules: ['palette colour utility'], value: base };
  }
  for (const [pattern, namespace, rule] of namespaces) {
    const match = pattern.exec(base);
    if (!match) continue;
    const key = match[1] ? `${namespace}-${match[1]}` : namespace;
    return theme.defaults.has(key) && !theme.mapped.has(key)
      ? { rules: [rule], value: base }
      : undefined;
  }
  return undefined;
}

/**
 * @param {string} css
 * @param {string} from
 * @returns {Map<string, string>}
 */
function themeProperties(css, from) {
  /** @type {Map<string, string>} */
  const properties = new Map();
  postcss.parse(css, { from }).walkAtRules('theme', (rule) => {
    rule.walkDecls((declaration) => {
      properties.set(declaration.prop, declaration.value);
    });
  });
  return properties;
}

/**
 * Tailwind's installed default theme, the keys the project's globals.css maps to tokens, and the
 * --prebid- names prebid.css defines.
 * @param {string} root
 * @returns {Theme}
 */
function loadTheme(root) {
  const defaultsPath = resolve(repository, 'node_modules/tailwindcss/theme.css');
  if (!existsSync(defaultsPath))
    throw new Error('Tailwind default theme not found: ' + defaultsPath);
  const defaults = themeProperties(readFileSync(defaultsPath, 'utf8'), defaultsPath);
  /** @type {Map<string, string>} */
  let project = new Map();
  const projectPath = resolve(root, mappingFile);
  if (existsSync(projectPath))
    try {
      project = themeProperties(readFileSync(projectPath, 'utf8'), mappingFile);
    } catch (error) {
      // The CSS scan reports the parse error for this file.
      if (!(error instanceof postcss.CssSyntaxError)) throw error;
    }
  /** @param {Map<string, string>} properties */
  const colours = (properties) =>
    new Set(
      [...properties.keys()]
        .filter((name) => name.startsWith('--color-'))
        .map((name) => name.slice('--color-'.length)),
    );
  /** @type {Set<string>} */
  const tokens = new Set();
  const tokenPath = resolve(root, tokenFile);
  if (existsSync(tokenPath))
    try {
      postcss
        .parse(readFileSync(tokenPath, 'utf8'), { from: tokenFile })
        .walkDecls((declaration) => {
          if (declaration.prop.startsWith('--prebid-') && isTokenDeclaration(declaration))
            tokens.add(declaration.prop);
        });
    } catch (error) {
      // The CSS scan reports the parse error for this file.
      if (!(error instanceof postcss.CssSyntaxError)) throw error;
    }
  return {
    defaults: new Set(defaults.keys()),
    mapped: new Set(
      [...project].filter(([, value]) => value.includes('var(')).map(([name]) => name),
    ),
    defaultColours: colours(defaults),
    projectColours: colours(project),
    tokens,
  };
}

/**
 * @param {string} root
 * @param {string} directory
 * @param {RegExp} pattern
 * @returns {string[]}
 */
function listFiles(root, directory, pattern) {
  const start = resolve(root, directory);
  /** @type {string[]} */
  const files = [];
  if (!existsSync(start)) return files;
  /** @param {string} path */
  function scan(path) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const child = resolve(path, entry.name);
      if (entry.isDirectory()) scan(child);
      else if (pattern.test(entry.name)) files.push(relative(root, child).split(sep).join('/'));
    }
  }
  scan(start);
  return files.sort();
}

/**
 * @param {import('postcss').ChildNode} node
 * @returns {{ context: string, selector: string, theme: boolean }}
 */
function cssLocation(node) {
  /** @type {string[]} */
  const atRules = [];
  /** @type {string[]} */
  const selectors = [];
  let theme = false;
  /** @type {import('postcss').Node | undefined} */
  let parent = node.parent;
  for (; parent; parent = /** @type {import('postcss').Node | undefined} */ (parent.parent)) {
    if (parent.type === 'atrule') {
      const rule = /** @type {import('postcss').AtRule} */ (parent);
      atRules.unshift(`@${rule.name} ${rule.params}`.trim().replace(/\s+/g, ' '));
      if (rule.name === 'theme') theme = true;
    } else if (parent.type === 'rule') {
      const rule = /** @type {import('postcss').Rule} */ (parent);
      selectors.unshift(
        postcss.list
          .comma(rule.selector)
          .map((selector) => selector.trim().replace(/\s+/g, ' '))
          .join(', '),
      );
    }
  }
  return { context: atRules.join(' > '), selector: selectors.join(' { '), theme };
}

/** @param {string} file */
function isFeatureModule(file) {
  return (
    file.endsWith('.module.css') &&
    !file.startsWith('src/components/ui/') &&
    !file.startsWith('src/styles/')
  );
}

/**
 * The complex selectors a rule matches: `&` stands for the parent rule's selectors, and a nested
 * selector without one is a descendant of them.
 * @param {import('postcss').Rule} rule
 * @returns {string[]}
 */
function resolvedSelectors(rule) {
  const own = postcss.list.comma(rule.selector).map((selector) => selector.trim());
  let parent = rule.parent;
  while (parent && parent.type === 'atrule') parent = parent.parent;
  if (parent?.type !== 'rule') return own;
  const outer = resolvedSelectors(/** @type {import('postcss').Rule} */ (parent));
  return outer.flatMap((prefix) =>
    own.map((selector) =>
      selector.includes('&') ? selector.replaceAll('&', prefix) : `${prefix} ${selector}`,
    ),
  );
}

/**
 * The combinator before a complex selector's last compound (' ', '>', '+', '~', or '' when there is
 * one compound) and that compound's lower-case type selector ('' when it has none).
 * @param {string} selector
 */
function lastCompound(selector) {
  const text = selector.trim();
  let depth = 0;
  let start = 0;
  let combinator = '';
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '\\') index++;
    else if (char === '"' || char === "'") {
      index++;
      while (index < text.length && text[index] !== char) index += text[index] === '\\' ? 2 : 1;
    } else if (char === '(' || char === '[') depth++;
    else if (char === ')' || char === ']') depth--;
    else if (depth === 0 && /[\s>+~]/.test(char)) {
      let end = index;
      combinator = ' ';
      for (; end < text.length && /[\s>+~]/.test(text[end]); end++)
        if (text[end].trim()) combinator = text[end];
      start = end;
      index = end - 1;
    }
  }
  return {
    combinator,
    element: /^[a-z][a-z\d-]*/i.exec(text.slice(start))?.[0].toLowerCase() ?? '',
  };
}

/**
 * Whether a declaration restyles a native control or a primitive's control through a descendant
 * or child selector.
 * @param {import('postcss').Declaration} declaration
 */
function restylesControl(declaration) {
  if (!restylesControlProperty(normaliseProperty(declaration.prop))) return false;
  /** @type {import('postcss').Node | undefined} */
  let rule = declaration.parent;
  while (rule && rule.type !== 'rule')
    rule = /** @type {import('postcss').Node | undefined} */ (rule.parent);
  if (rule?.type !== 'rule') return false;
  return resolvedSelectors(/** @type {import('postcss').Rule} */ (rule)).some((selector) => {
    const { combinator, element } = lastCompound(selector);
    return (combinator === ' ' || combinator === '>') && controlElements.has(element);
  });
}

/**
 * @param {string} root
 * @param {string} file
 * @param {Theme} theme
 * @param {Site[]} sites
 * @param {string[]} failures
 * @param {string[]} references undefined token names
 */
function inspectCss(root, file, theme, sites, failures, references) {
  /** @type {import('postcss').Root} */
  let parsed;
  try {
    parsed = postcss.parse(readFileSync(resolve(root, file), 'utf8'), { from: file });
  } catch (error) {
    if (!(error instanceof postcss.CssSyntaxError)) throw error;
    failures.push(`${file}:${error.line ?? 0}: CSS parse error: ${error.reason}`);
    return;
  }
  const definitions = file === tokenFile;
  const generic = file === mappingFile;
  const feature = isFeatureModule(file);
  parsed.walk((node) => {
    const line = node.source?.start?.line ?? 0;
    if (node.type === 'decl') {
      const { context, selector, theme: inTheme } = cssLocation(node);
      const key = { file, context, selector, property: node.prop, value: flat(node.value) };
      checkReferences(
        node.value,
        readVariables,
        theme.tokens,
        () => ({ ...key, line }),
        references,
      );
      if (definitions && isTokenDeclaration(node)) return;
      const rules = declarationRules(node.prop, node.value, { generic, theme: inTheme });
      if (feature && restylesControl(node)) rules.push('descendant control override');
      if (rules.length) sites.push({ ...key, line, rules });
    } else if (node.type === 'atrule' && node.name === 'apply') {
      const { context, selector } = cssLocation(node);
      for (const token of node.params.split(/\s+/)) {
        if (!token) continue;
        checkReferences(
          token,
          readBoth,
          theme.tokens,
          () => ({ file, line, context, selector, property: '@apply', value: token }),
          references,
        );
        const found = classRules(token, theme);
        if (found) sites.push({ file, line, context, selector, property: token, ...found });
      }
    }
  });
}

/** @param {string} text */
function flat(text) {
  return text.replace(/\s+/g, ' ').trim();
}

/** @param {ts.Node} node */
function unwrap(node) {
  let current = node;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isTypeAssertionExpression(current)
  )
    current = current.expression;
  return current;
}

/** @param {ts.Node} node */
function isNothing(node) {
  return (
    (ts.isIdentifier(node) && node.text === 'undefined') ||
    node.kind === ts.SyntaxKind.NullKeyword ||
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword
  );
}

/** @param {ts.CallExpression} call */
function helperName(call) {
  return ts.isIdentifier(call.expression) && helpers.has(call.expression.text)
    ? call.expression.text
    : undefined;
}

/**
 * A class value the scan cannot read: an identifier, or a call to anything but a class helper
 * (helper calls are read where they are visited).
 * @param {ts.Node} node unwrapped
 */
function isOpaqueClass(node) {
  return (
    (ts.isIdentifier(node) && !isNothing(node)) || (ts.isCallExpression(node) && !helperName(node))
  );
}

/**
 * @param {ts.Node} node
 * @returns {node is ts.StringLiteral | ts.TemplateLiteralLikeNode}
 */
function isText(node) {
  return (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isTemplateHead(node) ||
    ts.isTemplateMiddle(node) ||
    ts.isTemplateTail(node)
  );
}

/**
 * Whether raw JSX text holds a character reference to an arrow.
 * @param {string} text
 */
function referencesArrow(text) {
  for (const [, hex, decimal, name] of text.matchAll(characterReference)) {
    if (name !== undefined) {
      if (/arr/i.test(name)) return true;
    } else {
      const code = hex === undefined ? Number(decimal) : parseInt(hex, 16);
      if (code >= 0x2190 && code <= 0x21ff) return true;
    }
  }
  return false;
}

/**
 * @param {ts.Node} node
 * @returns {node is ts.JsxText | ts.StringLiteral | ts.TemplateLiteralLikeNode}
 */
function hasTextArrow(node) {
  if (ts.isJsxText(node) || (ts.isStringLiteral(node) && ts.isJsxAttribute(node.parent)))
    return textArrow.test(node.text) || referencesArrow(node.text);
  return isText(node) && textArrow.test(node.text);
}

/**
 * The node an arrow site is keyed by: the text itself, or the conditional, logical, concatenation
 * or template expression that chooses it.
 * @param {ts.Node} node
 */
function arrowOwner(node) {
  let current = node;
  while (
    ts.isParenthesizedExpression(current.parent) ||
    ts.isConditionalExpression(current.parent) ||
    ts.isBinaryExpression(current.parent) ||
    ts.isTemplateSpan(current.parent) ||
    ts.isTemplateExpression(current.parent)
  )
    current = current.parent;
  return current;
}

/** @param {ts.PropertyName} name */
function propertyName(name) {
  return ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name) ||
    ts.isNoSubstitutionTemplateLiteral(name) ||
    ts.isPrivateIdentifier(name)
    ? name.text
    : undefined;
}

/** @param {string} name a React style or SVG attribute name */
function cssProperty(name) {
  return name.startsWith('--') ? name : name.replace(/[A-Z]/g, (char) => '-' + char.toLowerCase());
}

/** @param {string} text */
function isClassAttribute(text) {
  return text === 'className' || text.endsWith('ClassName');
}

/**
 * @param {string} root
 * @param {string} file
 * @param {ts.ScriptKind} kind
 * @param {Theme} theme
 * @param {Site[]} sites
 * @param {string[]} unmodelled
 * @param {string[]} references undefined token names
 */
function inspectScript(root, file, kind, theme, sites, unmodelled, references) {
  const source = ts.createSourceFile(
    file,
    readFileSync(resolve(root, file), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    kind,
  );
  /** @type {Set<ts.Node>} */
  const consumed = new Set();
  /** @type {Set<ts.Node>} */
  const arrowSites = new Set();
  const readArrows = file.startsWith('src/');
  /** @param {ts.Node} node */
  const line = (node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

  /**
   * @param {ts.Node} node
   * @param {ts.Node} child
   * @returns {string | undefined}
   */
  function segment(node, child) {
    if (ts.isJsxAttribute(node)) {
      const element = node.parent.parent;
      return `<${element.tagName.getText(source)} ${node.name.getText(source)}>`;
    }
    if (ts.isCallExpression(node)) {
      const name = helperName(node);
      if (!name) return undefined;
      const owner = node.parent;
      return ts.isVariableDeclaration(owner) && ts.isIdentifier(owner.name)
        ? `${name} ${owner.name.text}`
        : name;
    }
    if (ts.isVariableDeclaration(node)) {
      if (!ts.isIdentifier(node.name)) return undefined;
      const value = node.initializer;
      return value && ts.isCallExpression(value) && helperName(value) ? undefined : node.name.text;
    }
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isClassDeclaration(node) ||
      ts.isClassExpression(node) ||
      ts.isMethodDeclaration(node)
    )
      return node.name
        ? node.name.getText(source)
        : ts.isFunctionDeclaration(node)
          ? 'default'
          : undefined;
    if (ts.isPropertyAssignment(node) && child !== node.name)
      return propertyName(node.name) ?? node.name.getText(source);
    return undefined;
  }

  /**
   * @param {ts.Node} node
   * @param {boolean} [keyed] the site is named by its own property, so that key is left out
   */
  function symbolPath(node, keyed = false) {
    /** @type {string[]} */
    const parts = [];
    let child = node;
    let skip = keyed;
    for (let current = node.parent; current; child = current, current = current.parent) {
      if (skip && ts.isPropertyAssignment(current) && child !== current.name) {
        skip = false;
        continue;
      }
      if (ts.isJsxAttribute(current) || ts.isFunctionLike(current)) skip = false;
      const part = segment(current, child);
      if (part) parts.unshift(part);
    }
    return parts.join(' > ');
  }

  /**
   * @param {ts.Node} node
   * @param {string} property
   * @param {string} value
   * @param {string[]} rules
   * @param {boolean} [keyed]
   */
  function addSite(node, property, value, rules, keyed = false) {
    sites.push({
      file,
      line: line(node),
      context: symbolPath(node, keyed),
      selector: '',
      property,
      value: flat(value),
      rules,
    });
  }

  /**
   * @param {ts.Node} node
   * @param {string} description
   * @param {boolean} [keyed]
   */
  function addUnmodelled(node, description, keyed = false) {
    const context = symbolPath(node, keyed);
    unmodelled.push(`${file}:${line(node)}: ${context ? `[${context}] ` : ''}${description}`);
  }

  /**
   * @param {ts.Node} node
   * @param {string} text
   */
  function classText(node, text) {
    // A class string can be reached from its attribute and from an enclosing helper call.
    if (consumed.has(node)) return;
    consumed.add(node);
    for (const token of text.split(/\s+/)) {
      if (!token) continue;
      // var() references in class strings are read with every other string, in visit.
      checkReferences(
        token,
        readShorthand,
        theme.tokens,
        () => ({
          file,
          line: line(node),
          context: symbolPath(node),
          selector: '',
          property: 'class',
          value: token,
        }),
        references,
      );
      const found = classRules(token, theme);
      if (found) addSite(node, token, found.value, found.rules);
    }
  }

  /**
   * Class strings an expression can evaluate to: literals, template parts, both branches of
   * conditionals, logical operands, array elements and, for cn/clsx, object keys. Identifiers and
   * calls among them are reported as unmodelled.
   * @param {ts.Node} expression
   * @param {boolean} objectKeys
   * @returns {void}
   */
  function collectClasses(expression, objectKeys) {
    const node = unwrap(expression);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      classText(node, node.text);
    } else if (ts.isTemplateExpression(node)) {
      let before = node.head.text;
      let joined = false;
      classText(node.head, before);
      for (const span of node.templateSpans) {
        const touching = /\S$/.test(before) || /^\S/.test(span.literal.text);
        joined ||= touching;
        // A value joined to the text beside it is reported once, with the whole template.
        if (!touching || !isOpaqueClass(unwrap(span.expression)))
          collectClasses(span.expression, objectKeys);
        classText(span.literal, span.literal.text);
        before = span.literal.text;
      }
      if (joined) addUnmodelled(node, 'class name built by interpolation: ' + node.getText(source));
    } else if (ts.isConditionalExpression(node)) {
      collectClasses(node.whenTrue, objectKeys);
      collectClasses(node.whenFalse, objectKeys);
    } else if (ts.isBinaryExpression(node)) {
      const operator = node.operatorToken.kind;
      if (operator === ts.SyntaxKind.AmpersandAmpersandToken) {
        collectClasses(node.right, objectKeys);
      } else if (
        operator === ts.SyntaxKind.BarBarToken ||
        operator === ts.SyntaxKind.QuestionQuestionToken
      ) {
        collectClasses(node.left, objectKeys);
        collectClasses(node.right, objectKeys);
      } else if (operator === ts.SyntaxKind.PlusToken) {
        const left = unwrap(node.left);
        const right = unwrap(node.right);
        const built =
          (ts.isStringLiteral(left) && /\S$/.test(left.text) && !ts.isStringLiteral(right)) ||
          (ts.isStringLiteral(right) && /^\S/.test(right.text) && !ts.isStringLiteral(left));
        if (built)
          addUnmodelled(node, 'class name built by concatenation: ' + node.getText(source));
        for (const operand of [left, right])
          if (!built || !isOpaqueClass(operand)) collectClasses(operand, objectKeys);
      }
    } else if (ts.isArrayLiteralExpression(node)) {
      for (const element of node.elements)
        collectClasses(ts.isSpreadElement(element) ? element.expression : element, objectKeys);
    } else if (objectKeys && ts.isObjectLiteralExpression(node)) {
      for (const property of node.properties) {
        if (ts.isSpreadAssignment(property)) collectClasses(property.expression, objectKeys);
        else if (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) {
          const name = propertyName(property.name);
          if (name !== undefined) classText(property.name, name);
        }
      }
    } else if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      const body = node.body;
      if (!ts.isBlock(body)) {
        collectClasses(body, objectKeys);
        return;
      }
      /**
       * @param {ts.Node} child
       * @returns {void}
       */
      const returns = (child) => {
        if (ts.isReturnStatement(child)) {
          if (child.expression) collectClasses(child.expression, objectKeys);
        } else if (!ts.isFunctionLike(child)) ts.forEachChild(child, returns);
      };
      ts.forEachChild(body, returns);
    } else if (isOpaqueClass(node)) {
      addUnmodelled(node, 'class value is not a literal: ' + node.getText(source));
    }
  }

  /**
   * @param {ts.Node} node
   * @returns {void}
   */
  function variantClasses(node) {
    const value = unwrap(node);
    if (!ts.isObjectLiteralExpression(value)) {
      collectClasses(value, false);
      return;
    }
    for (const property of value.properties)
      if (ts.isPropertyAssignment(property)) variantClasses(property.initializer);
  }

  /** @param {ts.CallExpression} call */
  function helperCall(call) {
    if (helperName(call) !== 'cva') {
      for (const argument of call.arguments)
        collectClasses(ts.isSpreadElement(argument) ? argument.expression : argument, true);
      return;
    }
    const [base, config] = call.arguments;
    if (base) collectClasses(base, false);
    if (!config) return;
    const options = unwrap(config);
    if (!ts.isObjectLiteralExpression(options)) {
      addUnmodelled(config, 'cva configuration is not an object literal');
      return;
    }
    for (const property of options.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      const name = propertyName(property.name);
      if (name === 'variants') variantClasses(property.initializer);
      if (name !== 'compoundVariants') continue;
      const compound = unwrap(property.initializer);
      if (!ts.isArrayLiteralExpression(compound)) continue;
      for (const element of compound.elements) {
        const entry = unwrap(element);
        if (!ts.isObjectLiteralExpression(entry)) continue;
        for (const field of entry.properties)
          if (
            ts.isPropertyAssignment(field) &&
            ['class', 'className'].includes(propertyName(field.name) ?? '')
          )
            collectClasses(field.initializer, false);
      }
    }
  }

  /**
   * @param {ts.Node} expression
   * @param {{ node: ts.Node, text: string }[]} literals
   * @returns {boolean} whether some branch is not a literal
   */
  function literalLeaves(expression, literals) {
    const node = unwrap(expression);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      literals.push({ node, text: node.text });
      return false;
    }
    if (ts.isNumericLiteral(node)) {
      literals.push({ node, text: node.text });
      return false;
    }
    if (
      ts.isPrefixUnaryExpression(node) &&
      node.operator === ts.SyntaxKind.MinusToken &&
      ts.isNumericLiteral(node.operand)
    ) {
      literals.push({ node, text: '-' + node.operand.text });
      return false;
    }
    if (isNothing(node)) return false;
    if (ts.isConditionalExpression(node)) {
      const whenTrue = literalLeaves(node.whenTrue, literals);
      return literalLeaves(node.whenFalse, literals) || whenTrue;
    }
    if (ts.isBinaryExpression(node)) {
      const operator = node.operatorToken.kind;
      if (operator === ts.SyntaxKind.AmpersandAmpersandToken)
        return literalLeaves(node.right, literals);
      if (
        operator === ts.SyntaxKind.BarBarToken ||
        operator === ts.SyntaxKind.QuestionQuestionToken
      ) {
        const left = literalLeaves(node.left, literals);
        return literalLeaves(node.right, literals) || left;
      }
    }
    return true;
  }

  /**
   * @param {string} name as written in source
   * @param {ts.Node} expression
   * @param {string} [property] the CSS property the value sets
   */
  function styleValue(name, expression, property = cssProperty(name)) {
    /** @type {{ node: ts.Node, text: string }[]} */
    const literals = [];
    const opaque = literalLeaves(expression, literals);
    for (const literal of literals) {
      if (consumed.has(literal.node)) continue;
      consumed.add(literal.node);
      const rules = declarationRules(property, literal.text);
      if (rules.length) addSite(literal.node, name, literal.text, rules, true);
    }
    if (opaque && isVisualProperty(normaliseProperty(property)))
      addUnmodelled(
        expression,
        `${name} value is not a literal: ${expression.getText(source)}`,
        true,
      );
  }

  /**
   * @param {ts.ObjectLiteralExpression} object
   * @param {boolean} style a style object, where spreads and computed keys are reported too
   * @returns {void}
   */
  function styleObject(object, style) {
    for (const property of object.properties) {
      if (ts.isSpreadAssignment(property)) {
        const spread = unwrap(property.expression);
        if (style) styleExpression(spread, '');
        else if (ts.isObjectLiteralExpression(spread)) styleObject(spread, false);
      } else if (ts.isShorthandPropertyAssignment(property)) {
        if (isVisualProperty(normaliseProperty(cssProperty(property.name.text))))
          addUnmodelled(property, `${property.name.text} value is not a literal`, true);
      } else if (ts.isPropertyAssignment(property)) {
        const name = propertyName(property.name);
        const value = unwrap(property.initializer);
        if (name === undefined) {
          if (style)
            addUnmodelled(property, 'computed style key: ' + property.name.getText(source));
        } else if (ts.isObjectLiteralExpression(value)) styleObject(value, style);
        else styleValue(name, value);
      }
    }
  }

  /**
   * @param {ts.Node} expression
   * @param {string} attribute the attribute name, or '' for a spread inside a style object
   * @returns {void}
   */
  function styleExpression(expression, attribute) {
    const node = unwrap(expression);
    if (ts.isObjectLiteralExpression(node)) styleObject(node, true);
    else if (ts.isConditionalExpression(node)) {
      styleExpression(node.whenTrue, attribute);
      styleExpression(node.whenFalse, attribute);
    } else if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
    )
      styleExpression(node.right, attribute);
    else if (!isNothing(node))
      addUnmodelled(
        node,
        `${attribute ? `${attribute}={${node.getText(source)}}` : `...${node.getText(source)}`} is not an object literal`,
      );
  }

  /** @param {ts.JsxAttribute} attribute */
  function jsxAttribute(attribute) {
    const name = attribute.name.getText(source);
    const initializer = attribute.initializer;
    if (!initializer) return;
    const expression = ts.isJsxExpression(initializer) ? initializer.expression : initializer;
    if (!expression) return;
    const property = attributeProperties.get(name);
    if (isClassAttribute(name)) collectClasses(expression, false);
    else if (name === 'style' || name.endsWith('Style')) styleExpression(expression, name);
    else if (property) {
      const value = unwrap(expression);
      // Recharts takes a bar radius per corner as an array.
      if (name === 'radius' && ts.isArrayLiteralExpression(value))
        for (const element of value.elements) styleValue(name, element, property);
      else styleValue(name, expression, property);
    } else {
      const value = unwrap(expression);
      if (ts.isObjectLiteralExpression(value)) styleObject(value, false);
    }
  }

  /**
   * Never returns a value: ts.forEachChild stops at the first truthy callback result.
   * @param {ts.Node} node
   * @returns {void}
   */
  function visit(node) {
    if (isText(node))
      checkReferences(
        node.text,
        readVariables,
        theme.tokens,
        () => ({
          file,
          line: line(node),
          context: symbolPath(node),
          selector: '',
          property: 'string',
          value: flat(node.text),
        }),
        references,
      );
    if (ts.isJsxAttribute(node)) jsxAttribute(node);
    else if (ts.isCallExpression(node) && helperName(node)) helperCall(node);
    else if (
      (ts.isPropertyAssignment(node) || ts.isVariableDeclaration(node)) &&
      node.initializer &&
      ts.isIdentifier(node.name) &&
      isClassAttribute(node.name.text)
    )
      collectClasses(node.initializer, false);
    else if (
      isText(node) &&
      !consumed.has(node) &&
      (stringHex.test(node.text) || stringFunction.test(node.text))
    )
      addSite(node, 'string', node.text, ['colour literal']);
    if (readArrows && hasTextArrow(node)) {
      const owner = arrowOwner(node);
      if (!arrowSites.has(owner)) {
        arrowSites.add(owner);
        addSite(owner, 'text', owner === node ? node.text : owner.getText(source), ['text arrow']);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

/** @param {Key} key */
function keyOf(key) {
  return JSON.stringify([key.file, key.context, key.selector, key.property, key.value]);
}

/** @param {Key} key */
function describe(key) {
  return (
    (key.context ? `[${key.context}] ` : '') +
    (key.selector ? key.selector + ' ' : '') +
    `${key.property}: ${key.value}`
  );
}

/**
 * @param {string} root
 * @param {unknown} option a path relative to root, or the decoded allowlist
 * @returns {{ entries: Entry[], failures: string[] }}
 */
function readAllowlist(root, option) {
  /** @type {unknown} */
  let decoded = option;
  if (option === undefined || typeof option === 'string') {
    const path = resolve(root, option ?? defaultAllowlist);
    if (!existsSync(path))
      return {
        entries: [],
        failures: option === undefined ? [] : ['Allowlist not found: ' + option],
      };
    try {
      decoded = JSON.parse(readFileSync(path, 'utf8'));
    } catch (error) {
      return { entries: [], failures: ['Invalid allowlist: ' + String(error)] };
    }
  }
  const parsed = allowlistSchema.safeParse(decoded);
  if (!parsed.success)
    return {
      entries: [],
      failures: [
        'Invalid allowlist: ' +
          parsed.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; '),
      ],
    };
  return { entries: parsed.data.entries, failures: [] };
}

/**
 * @typedef {{ allowlist?: unknown, completedPhases?: readonly string[] }} Options allowlist: a
 *   path relative to root, or its content; completedPhases: defaults to the exported list
 */

/**
 * @param {string} root
 * @param {Options} options
 */
function evaluate(root, { allowlist, completedPhases: completed = completedPhases } = {}) {
  const cssFiles = listFiles(root, 'src', /\.css$/);
  const tsxFiles = [
    ...listFiles(root, 'src', /\.tsx$/),
    ...listFiles(root, '.storybook', /\.tsx$/),
  ];
  const tsFiles = listFiles(root, 'src', /\.[cm]?ts$/);
  const theme = loadTheme(root);
  /** @type {Site[]} */
  const sites = [];
  /** @type {string[]} */
  const parseFailures = [];
  /** @type {string[]} */
  const unmodelled = [];
  /** @type {string[]} */
  const references = [];
  for (const file of cssFiles) inspectCss(root, file, theme, sites, parseFailures, references);
  for (const file of tsxFiles)
    inspectScript(root, file, ts.ScriptKind.TSX, theme, sites, unmodelled, references);
  for (const file of tsFiles)
    inspectScript(root, file, ts.ScriptKind.TS, theme, sites, unmodelled, references);
  // Identical sites in one context are told apart by order, so each entry names one site.
  /** @type {Map<string, number>} */
  const seen = new Map();
  for (const site of sites) {
    const key = keyOf(site);
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    if (count > 1) site.context = `${site.context} #${count}`.trim();
  }
  const loaded = readAllowlist(root, allowlist);
  const allowlistFailures = [...loaded.failures];
  /** @type {Map<string, { entry: Entry, used: boolean }>} */
  const entries = new Map();
  for (const entry of loaded.entries) {
    const label = entry.file + ' ' + describe(entry);
    if (entries.has(keyOf(entry))) {
      allowlistFailures.push('Duplicate allowlist entry: ' + label);
      continue;
    }
    entries.set(keyOf(entry), { entry, used: false });
    if (completed.includes(entry.phase))
      allowlistFailures.push(
        `Allowlist entry is owned by completed phase ${entry.phase}: ${label}`,
      );
    else if (!phases.includes(entry.phase))
      allowlistFailures.push(
        `Allowlist entry phase ${JSON.stringify(entry.phase)} is not P2, P3 or P4: ${label}`,
      );
    if (!entry.reason.trim()) allowlistFailures.push('Allowlist entry has no reason: ' + label);
  }
  let allowlisted = 0;
  /** @type {Site[]} */
  const open = [];
  for (const site of sites) {
    const match = entries.get(keyOf(site));
    if (match && !match.used) {
      match.used = true;
      allowlisted++;
    } else open.push(site);
  }
  for (const { entry, used } of entries.values())
    if (!used)
      allowlistFailures.push('Unused allowlist entry: ' + entry.file + ' ' + describe(entry));
  const failures = [
    ...parseFailures,
    ...open.map((site) => `${site.file}:${site.line}: ${site.rules.join(', ')}: ${describe(site)}`),
    ...references,
    ...allowlistFailures,
  ];
  if (unmodelled.length > unmodelledCeiling)
    failures.push(
      `${unmodelled.length} unmodelled sites exceed the ceiling of ${unmodelledCeiling}`,
    );
  if (!cssFiles.length) failures.push('No CSS files selected');
  if (!tsxFiles.length) failures.push('No TSX files selected');
  return {
    result: { root, cssFiles, tsxFiles, tsFiles, allowlisted, failures, unmodelled },
    open,
  };
}

/**
 * @param {string} root
 * @param {Options} [options]
 */
export function inspectDesignTokens(root, options = {}) {
  return evaluate(root, options).result;
}

/**
 * Allowlist entries for every site that fails today, with phase and reason left to fill in.
 * @param {string} root
 * @param {Options} [options]
 */
export function designTokenCandidates(root, options = {}) {
  const { result, open } = evaluate(root, options);
  return {
    failures: result.failures.length,
    candidates: {
      version: 1,
      entries: open.map(({ file, context, selector, property, value }) => ({
        file,
        context,
        selector,
        property,
        value,
        phase: '',
        reason: '',
      })),
    },
  };
}

// import.meta.main also holds when the script is reached through a symlinked path.
if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--candidates')) {
    console.error('Expected [--candidates]');
    process.exitCode = 1;
  } else if (args.includes('--candidates')) {
    const { failures, candidates } = designTokenCandidates(process.cwd());
    console.log(JSON.stringify(candidates, null, 2));
    if (failures) process.exitCode = 1;
  } else {
    const result = inspectDesignTokens(process.cwd());
    console.log(JSON.stringify(result, null, 2));
    if (result.failures.length) process.exitCode = 1;
  }
}
