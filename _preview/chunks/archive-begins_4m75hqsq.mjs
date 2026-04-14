import { a as createComponent, m as maybeRenderHead, u as unescapeHTML, d as renderTemplate } from './astro/server_BemJfg4n.mjs';
import 'kleur/colors';
import 'clsx';

const html = "";

				const frontmatter = {"title":"Archive stewardship begins","date":"2026-04","project":"life","kind":"milestone","summary":"Colin's brother Dyl takes on stewardship of the CRFW archive — roughly 45,000 files, 125 GB — and begins the work of reorganizing, preserving, and eventually presenting it. This timeline site is that presentation.\n","tags":["meta","archive"]};
				const file = "/sessions/amazing-keen-gates/mnt/outputs/crfw-site/src/content/events/archive-begins.md";
				const url = undefined;
				function rawContent() {
					return "";
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
