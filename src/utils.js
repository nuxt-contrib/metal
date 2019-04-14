
// Parse the `str` url with fast-path short-cut.
export function pathname (url) {
  let i = 0
  for (; i < url.length; i++) {
    switch (str.charCodeAt(i)) {
      case 0x3f: /* ? */
        return url.substring(0, i)
      case 0x23: /* # */
        return url.substring(0, i)
    }
  }
  return url.substring(0, i)
}

// Parse a URL up to the end of the domain name
export function trimURLPath(url) {
  let i = 0
  let s = 0
  for (; i < url.length; i++) {
    switch (url.charCodeAt(i)) {
      case 47:
        s++
        if (i === 0) {
          return
        }
        if (s > 2) {
          return url.substr(0, i)
        }
        break
    }
  }
  return s <= 2 ? undefined : url
}

// RegExp to match non-URL code points, *after* encoding (i.e. not including
// "%") and including invalid escape sequences.
const ENCODE_CHARS_REGEXP =
  /(?:[^\x21\x25\x26-\x3B\x3D\x3F-\x5B\x5D\x5F\x61-\x7A\x7E]|%(?:[^0-9A-Fa-f]|[0-9A-Fa-f][^0-9A-Fa-f]|$))+/g

// RegExp to match unmatched surrogate pair.
const UNMATCHED_SURROGATE_PAIR_REGEXP =
  /(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]|[\uD800-\uDBFF]([^\uDC00-\uDFFF]|$)/g

// String to replace unmatched surrogate pair with.
const UNMATCHED_SURROGATE_PAIR_REPLACE = '$1\uFFFD$2'

// Encode a URL to a percent-encoded form, excluding already-encoded sequences.
//
// This function will take an already-encoded URL and encode all the non-URL
// code points. This function will not encode the "%" character unless it is
// not part of a valid sequence (`%20` will be left as-is, but `%foo` will
// be encoded as `%25foo`).
//
// This encode is meant to be "safe" and does not throw errors. It will 
// try as hard as it can to properly encode the given URL, including replacing 
// any raw, unpaired surrogate pairs with the Unicode replacement character 
// prior to encoding.
export function encodeUrl (url) {
  return String(url)
    .replace(UNMATCHED_SURROGATE_PAIR_REGEXP, UNMATCHED_SURROGATE_PAIR_REPLACE)
    .replace(ENCODE_CHARS_REGEXP, encodeURI)
}

// Heavily based on the code from:
// https://github.com/pillarjs/parseurl
// https://github.com/pillarjs/encodeurl
