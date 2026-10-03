# UXO design audit (October 2026)

Audit of the React/Tailwind interface (`src/`): tokens, themes, contrast,
accessibility, layout at the minimum window size (680×570), consistency and
states. Items marked **done** were fixed in the same change as this document;
the rest are open follow-ups ordered by impact.

## Critical

| #   | Finding                                                                                                                                                                                      | Status                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1   | `surface-glass`, `on-accent`, `shadow` were not registered in `@theme`, so `bg-surface-glass`/`text-on-accent` generated no CSS: dropdowns, tooltips and onboarding cards had no background. | **done** (`App.css`)                                   |
| 2   | Toggles and sliders had no accessible name.                                                                                                                                                  | **done** (`ToggleSwitch`, `Slider`)                    |
| 3   | 7 of 8 `ResetButton`s had no label.                                                                                                                                                          | **done** (default `common.reset`)                      |
| 4   | Onboarding model list was cut off and could not scroll at the minimum window size.                                                                                                           | **done** (`Onboarding.tsx`)                            |
| 5   | Post-processing fields use `min-w-[320–380px]` in a horizontal row and overflow at 680 px.                                                                                                   | open – switch to `layout="stacked"` + `w-full min-w-0` |
| 6   | `danger` button used white text on `#ff7c88` in dark mode (~2.3:1).                                                                                                                          | **done** (`text-on-accent`)                            |
| 7   | Light-only `gray-*`/`red-*` colours broke dark mode in data/log directory rows and accessibility buttons.                                                                                    | **done**                                               |
| 8   | `emerald-400`/`green-400` status colours were ~1.8:1 in light mode.                                                                                                                          | **done** (theme tokens)                                |

## Important

- **done** – Hard-coded strings moved to i18n (`SettingContainer`, `TextDisplay`, `Dropdown`, `AudioPlayer`, `SoundPicker`, overlay cancel, `App.tsx` unknown error); ESLint now also checks `aria-label`, `title`, `placeholder`, `alt`, `label` attributes.
- **done** – Low-contrast secondary text (`text-text/45–55`) in group headings, footer and history icons → `text-mid-gray`.
- **done** – Overlay: `role="status"` on the working label, reduced-motion now covers spinner and caret, larger cancel hit area, themed timer colour.
- **done** – RTL: physical `left/right/ml/mr/text-left` → logical utilities in onboarding and models.
- **done** – Sidebar `<nav>` label, duplicate `h1` on Models, Space key on model cards, Toaster follows the selected theme.
- open – Five different dropdown implementations (`Dropdown`, `react-select`, `LanguageSelector`, model-language filter, `ModelDropdown`) with different radii, borders and keyboard behaviour → one Listbox/Combobox primitive.
- open – Legacy hand-styled buttons (`KeyboardDiagnostic`, shortcut inputs, `LanguageSelector` trigger) → `<Button>` with an `icon` size (≥ 32 px).
- open – Type scale is inverted: setting titles are 13 px while descriptions are 14 px; arbitrary `text-[10px]`/`text-[11px]`.
- open – Hit targets below 32 px: help "?" (24 px), dialog close (24 px), history icon buttons, reset buttons.
- open – Tooltip is hover/click only: add focus, `aria-describedby`, `role="tooltip"`, Escape.
- open – Model status dot conveys state by colour only; history "saved" toggle lacks `aria-pressed`.

## Nice to have

- Unify radii (control `xl`, card `2xl`); move `Dialog` to the glass style.
- Page header `min-h-24` + footer take a quarter of a 570 px window; consider 64 px.
- Sidebar `w-48` + `truncate` cuts long German/Russian labels; allow two lines.
- Startup renders `null` (blank window) – show a skeleton; empty history needs an icon and hint.
- Off-toggle border is ~1.4:1 against white (WCAG 1.4.11 wants 3:1).
- `AudioPlayer` uses off-palette `#FAA2CA`; dead CSS (`.container`, `.bg-logo-primary/80`).
- `blur(84px)` ambient layer plus several `backdrop-filter`s may be slow on WebKitGTK.
