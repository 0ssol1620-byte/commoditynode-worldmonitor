# CommodityNode canonical and language policy

CommodityNode currently publishes one reviewed language: English. It does not
emit speculative alternates for translations that do not exist.

## Research surface

- Every `commoditynode.com` page emits an absolute self-referencing canonical.
- Every indexable research page emits `hreflang="en"` and
  `hreflang="x-default"` to that same canonical.
- Tracking parameters never change the canonical.
- Only the apex research surface owns research sitemap entries.
- Search results, source-offer pages, unpublished records, fixtures, and
  internal tools remain `noindex` under the route policy and do not advertise
  language alternates.

## Live surface

- The JavaScript dashboard canonical is `https://commoditynode.com/live/`.
- The live shell emits English and x-default alternates to that URL.
- CommodityNode defaults to reviewed English even when the browser or operating
  system advertises another locale. A `ko-KR` browser therefore still receives
  `lang="en"` and English analytical copy.
- A language changes only through an explicit `?lang=` request or a language
  choice saved by the user in Settings. Browser locale alone never changes the
  CommodityNode product language.
- The live dashboard remains `noindex, follow`; it supports research rather
  than competing with the substantive research inventory.
- The research site links to the live surface as an analytical extension, not
  as a duplicate article.
- The retired `live.commoditynode.com` hostname permanently redirects to the
  matching canonical apex surface and never owns a second canonical.

## Legacy URLs

- A permanent redirect is used only when the old and new pages are genuinely
  equivalent.
- Retired or low-value legacy routes return `410 Gone` with `noindex`.
- A `410` response does not emit a canonical that would imply equivalent
  content.
- No legacy route appears in a sitemap or receives an ad slot.

## Future translations

A new language may be advertised only when every alternate:

1. exists at a stable, crawlable URL;
2. has equivalent reviewed content;
3. references itself and every reciprocal alternate;
4. preserves source, author, correction, and publication-state contracts;
5. passes the same content and structured-data gates as English.
