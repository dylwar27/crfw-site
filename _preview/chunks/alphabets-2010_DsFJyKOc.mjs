import { a as createComponent, m as maybeRenderHead, u as unescapeHTML, d as renderTemplate } from './astro/server_BemJfg4n.mjs';
import 'kleur/colors';
import 'clsx';

const html = "<p>Placeholder. The alphabets era is deep and undocumented — this entry marks the\nstarting point of the timeline. A full pass through the 169 alphabets folders is\nthe next piece of catalogue work.</p>";

				const frontmatter = {"title":"2010 [_]","preservedTitle":"2010[_]","project":"alphabets","date":"2010","era":"alphabets — first recordings","format":"other","coverArt":"/media/releases/court-clothes/cover.svg","tags":["alphabets","early-era"],"archivePath":"CRFW Archive/_Documentation/alphabets/2010[_]/","summary":"One of the earliest folders in the alphabets era. The archive contains 169 alphabets-era folders spanning 2007–2013 — the original INDEX listed only six. This entry is a placeholder representing the start of Colin's working discography.\n"};
				const file = "/sessions/amazing-keen-gates/mnt/outputs/crfw-site/src/content/releases/alphabets-2010.md";
				const url = undefined;
				function rawContent() {
					return "\nPlaceholder. The alphabets era is deep and undocumented — this entry marks the\nstarting point of the timeline. A full pass through the 169 alphabets folders is\nthe next piece of catalogue work.\n";
				}
				function compiledContent() {
					return html;
				}
				function getHeadings() {
					return [];
				}

				const Content = createComponent((result, _props, slots) => {
					const { layout, ...content } = frontmatter;
					content.file = file;
					content.url = url;

					return renderTemplate`${maybeRenderHead()}${unescapeHTML(html)}`;
				});

export { Content, compiledContent, Content as default, file, frontmatter, getHeadings, rawContent, url };
