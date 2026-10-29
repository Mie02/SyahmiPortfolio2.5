# Ahmad Syahmi Zufayri — portfolio

Static HTML, CSS and classic JavaScript. Open `index.html` directly, or serve this folder with a local web server. Internet access is needed for the existing pinned fonts and animation libraries; readable content and CSS backgrounds remain available if the libraries fail.

All pages use `style.css` and the `script.js` entry point. It loads the local `space.js` helper, which loads the already-pinned Three r128 only when the scene needs it. `data-space="hero|lite|off"` selects the scene. Mobile and low-end inner pages use CSS backgrounds. No build step or additional dependencies are required.

The project page filters All, Unity, OpenGL, Blender and Motion. A filter is stored in the URL hash. Grid space is reserved across filters so the page and footer do not jump.

## Cinematic 3D experience

The home page now features a procedural orbital sculpture: a shaded globe, three solid illuminated rings, satellites and an asteroid belt. The rings assemble on entry; scrolling turns the scene. Drag horizontally to rotate it, or focus the scene and use arrow keys. Home resets its orientation. The buttons provide the same controls without dragging. Touch movement keeps vertical page scrolling available.

Desktop widths of 1024px and above use a project fly-through with a procedural tunnel. Focusing a project restores the normal reading layout. Cards on Projects, Biodata, Skills and the home statistics use pointer-controlled perspective. Same-site page links have a bounded 480ms warp with an arrival transition.

Reduced motion is respected by default. **Enable motion** explicitly opts into animation for this browser tab's session, including subsequent pages. **Pause motion** freezes the WebGL scene; manual rotation still works. Mobile uses lower geometry counts and a pixel-ratio cap of 1. If WebGL or the pinned library fails, the illustrated CSS orbit and normal content remain available. No model downloads, image textures, new libraries or build tools were added.

## Fill the supplied placeholders

- Replace `[PLACEHOLDER: SITE_URL]` throughout the HTML, `robots.txt` and `sitemap.xml` with the real HTTPS site URL, including any project subfolder, without a trailing slash. Sharing images and canonical URLs need this value before publishing.
- Add the CV file, then replace the disabled Download CV button in `index.html` with an anchor using its real relative path and the `download` attribute. Remove the adjacent CV-path placeholder.
- Supply the LinkedIn URL and replace its placeholder text with a real link.
- Fill project roles, timelines, challenges and outcomes. Supply the FYP tools, implemented features and media. The only confirmed FYP details are its AR indoor navigation purpose, the FTMK building and its in-progress status.
- Existing media include a portrait placeholder, Bujang Lapok placeholders and a Blender Workshop placeholder. Two supplied education logos do not match their surrounding institution labels; confirm the correct assets before replacing them. No media were rewritten.

The final handoff includes the full placeholder inventory and verification results. No dates, outcomes or metrics were invented to fill gaps.

## Hosting notes

Keep the folder layout and relative paths. The themed `404.html` works when requested directly and for missing pages at the site folder level. Once SITE_URL is filled, its small inline base resolver loads the shared assets from the correct project root even on nested missing routes. Direct file previews retain relative paths. Until the public URL is supplied, preview the page through `404.html` itself.

The robots and sitemap files intentionally retain the requested URL placeholder until the public address is supplied. No deployment has been performed. The original `apple.css` and `apple-script.js` remain unused as retained source files.
