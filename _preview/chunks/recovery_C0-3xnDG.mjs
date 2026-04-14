import { a as createComponent, m as maybeRenderHead, u as unescapeHTML, d as renderTemplate } from './astro/server_BemJfg4n.mjs';
import 'kleur/colors';
import 'clsx';

const html = "<p>Stub entry. Needs tracklist reconstruction.</p>";

				const frontmatter = {"title":"Recovery","preservedTitle":"RecoveryFinaL","project":"killd by","date":"2017","era":"killd by — Recovery era","format":"LP","coverArt":"/media/releases/court-clothes/cover.svg","tracklist":[{"n":1,"title":"LiKe a PeLiCaN","preservedTitle":"LiKe a PeLiCaN"}],"tags":["killd-by","recovery","late-era"],"archivePath":"CRFW Archive/_Documentation/KB/killd by/171 RecoveryFinaL/","summary":"Recovery appears in four folders in the archive — 169 REcovery Drafts, 170 Recovery4Burn, 171 RecoveryFinaL, 172 RECOVERYWAV. The numbered prefixes are Colin's own chronology. This entry is a stub: only the opening track \"LiKe a PeLiCaN\" has been surfaced so far. The rest of the tracklist needs to be reconstructed from the four variant folders and cross-referenced with RcvryDrafts.\n"};
				const file = "/sessions/amazing-keen-gates/mnt/outputs/crfw-site/src/content/releases/recovery.md";
				const url = undefined;
				function rawContent() {
					return "\nStub entry. Needs tracklist reconstruction.\n";
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
