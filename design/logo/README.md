# Jaune logo studies — hinomaru direction

Eight studies on one idea: the Japanese flag with the red disc replaced by a bright yellow one.
Presented as a board at the artifact link in the PM log; these are the source files.

The reference holds up for three reasons. *Jaune* is French for yellow. The hinomaru (日の丸,
"circle of the sun") is a sun disc, not an abstract dot. And the product is a brief that arrives
at the start of a day.

## The files

| File | What it is |
|---|---|
| `hinomaru.svg` | The straight swap. Japan's flag spec exactly — field 3:2, disc centred, disc diameter ⅗ of the height. |
| `point-icon.svg` | The same disc on a 1:1 rounded tile, for app icons and favicons. |
| `lever.svg` | The disc mid-rise, cut by a hairline horizon at ⅔ height. |
| `wordmark.svg` | `jaune` with the yellow disc as the dot on the j. Set in Bitstream Charter, converted to outlines — no font dependency. |
| `demi.svg` | The disc split into a lit half and a shadow half. |
| `fleur.svg` | The current eight-petal mark from `app/icon.svg`, knocked out of the disc. |
| `lueur.svg` | The disc as a soft light source, no hard edge. Atmosphere asset, not a logo. |
| `anneau.svg` | The disc with a 4-unit ink ring. The only one that holds its shape at 16px on white. |

## Colours

| Token | Hex | Use |
|---|---|---|
| jaune | `#FFD100` | the disc |
| jaune deep | `#E09A00` | shadow half in `demi.svg` |
| ink | `#16150F` | horizon rule, ring, wordmark |

## The contrast problem

Red on white is about 4:1. Yellow on white is not close, which is why no national flag puts a
bare yellow disc on white:

| Yellow | On white | On ink |
|---|---|---|
| `#FFF04A` citron | 1.18:1 | 15.5:1 |
| `#FFE01F` lemon | 1.32:1 | 13.9:1 |
| `#FFD100` jaune | 1.46:1 | 12.5:1 |
| `#FDC300` golden | 1.62:1 | 11.3:1 |
| `#F5B000` amber | 1.89:1 | 9.7:1 |

Three ways out, and only one is needed: give the disc an edge (`anneau.svg`), give it an internal
division so the shape survives (`demi.svg`), or put it on ink rather than white — which is what
Jaune's own UI already is.

## One thing to avoid

Don't add rays. The rayed variant (旭日旗, *kyokujitsu-ki*) is the imperial military ensign and is
read as a provocation across much of Korea and China. A plain disc carries none of that history.

## Nothing here is wired up yet

`app/icon.svg` and `app/favicon.ico` still hold the existing eight-petal mark. These files are
proposals — swapping them in is a separate, deliberate change once a direction is picked.

## Regenerating

The wordmark outline was extracted from Bitstream Charter with `fontTools`, dropping the tittle
contour from the `j` and substituting a disc at that position. There is no build step; the SVGs
are committed as final artwork.
