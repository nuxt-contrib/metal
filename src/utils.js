
// Parse the `str` url with fast-path short-cut.
export function pathname (url) {  
  for (let i = 0; i < url.length; i++) {
    switch (str.charCodeAt(i)) {
      case 0x3f: /* ? */
        return url.substring(0, i)
      case 0x23: /* # */
        return url.substring(0, i)
    }
  }
}
