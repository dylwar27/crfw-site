import { a as createComponent, m as maybeRenderHead, u as unescapeHTML, d as renderTemplate } from './astro/server_BemJfg4n.mjs';
import 'kleur/colors';
import 'clsx';

const html = "<h2 id=\"how-colin-kept-this-album\">How Colin kept this album</h2>\n<p>Ten tracks, but the folder that holds them also holds the draft pool, the alternate\nmix with noise floor (“NOIZ_ATMO”), the pre-master, and the single unified 58-minute\nalbum mix. He worked in layers — draft → final → burn — and kept every layer.</p>\n<h2 id=\"where-it-lives-in-the-archive\">Where it lives in the archive</h2>\n<p><code>CRFW Archive/_Documentation/KB/killd by/41 CCFinaLsWAVs/</code> is the canonical final\nstage. <code>40 CCdrafts</code> is the step before it; <code>52 CourtClothes4Burn</code> is the step after.\nMultiple variant folders exist alongside — those are intentional, not duplicates.</p>";

				const frontmatter = {"title":"Court Clothes","preservedTitle":"CourtClothes","project":"killd by","date":"2014","era":"killd by — early LPs","format":"LP","coverArt":"/media/releases/court-clothes/cover.svg","tracklist":[{"n":1,"title":"butterFly eFFecT","preservedTitle":"butterFly eFFecT"},{"n":2,"title":"hopeless [222]","preservedTitle":"hopeless [222]"},{"n":3,"title":"e.v.i.L a.n.g.eLz","preservedTitle":"_e_v_i_L__a_n_g_eLz_"},{"n":4,"title":"COPE","preservedTitle":"COPE_"},{"n":5,"title":"birD jaiL","preservedTitle":"birD__jaiL"},{"n":6,"title":"thunder stoned","preservedTitle":"thunder__stoned_"},{"n":7,"title":"L.i.g.h.t & Acid","preservedTitle":"_L_i_g_h_t_&_Acid"},{"n":8,"title":"FLAG burn","preservedTitle":"FLAG_burn__"},{"n":9,"title":"generation-zebra","preservedTitle":"generation-zebra"},{"n":10,"title":"no decision","preservedTitle":"_no_decision_"}],"tags":["killd-by","debut-lp","court-clothes"],"archivePath":"CRFW Archive/_Documentation/KB/killd by/41 CCFinaLsWAVs/","summary":"Court Clothes is the first full-length LP to surface under the \"killd by\" name. The archive holds it in multiple stages — CCdrafts (working versions), CCFinaLsWAVs (finished mixes plus 58-minute continuous album mix), CourtClothes4Burn (final m4a sequence ready to burn), plus several alternate mixes like NOIZ_ATMO and the Pre-Master pass. The track titles carry Colin's signature orthography: capitalization as emphasis, underscores as spacing, a visual rhythm that doesn't survive typing them cleanly. We preserve the originals under each title.\n"};
				const file = "/sessions/amazing-keen-gates/mnt/outputs/crfw-site/src/content/releases/court-clothes.md";
				const url = undefined;
				function rawContent() {
					return "\n## How Colin kept this album\n\nTen tracks, but the folder that holds them also holds the draft pool, the alternate\nmix with noise floor (\"NOIZ_ATMO\"), the pre-master, and the single unified 58-minute\nalbum mix. He worked in layers — draft → final → burn — and kept every layer.\n\n## Where it lives in the archive\n\n`CRFW Archive/_Documentation/KB/killd by/41 CCFinaLsWAVs/` is the canonical final\nstage. `40 CCdrafts` is the step before it; `52 CourtClothes4Burn` is the step after.\nMultiple variant folders exist alongside — those are intentional, not duplicates.\n";
				}
				function compiledContent() {
					return html;
				}
				function getHeadings() {
					return [{"depth":2,"slug":"how-colin-kept-this-album","text":"How Colin kept this album"},{"depth":2,"slug":"where-it-lives-in-the-archive","text":"Where it lives in the archive"}];
				}

				const Content = createComponent((result, _props, slots) => {
					const { layout, ...content } = frontmatter;
					content.file = file;
					content.url = url;

					return renderTemplate`${maybeRenderHead()}${unescapeHTML(html)}`;
				});

export { Content, compiledContent, Content as default, file, frontmatter, getHeadings, rawContent, url };
