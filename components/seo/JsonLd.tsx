/**
 * Renders a schema.org record for crawlers.
 *
 * Structured data is what turns a plain blue link into a result showing a
 * price, a star rating and "In stock" — which is most of the reason a
 * shopper clicks one listing over another.
 *
 * JSON.stringify then escaping `<`: a product name or review containing
 * "</script>" would otherwise close the tag early and inject markup. The
 * data here is store-controlled, but it is user-visible text flowing into a
 * script element, and that is exactly the shape of an XSS bug — so it is
 * escaped at the one place every record passes through rather than trusted
 * at each call site. < is valid JSON and parses back to "<".
 */
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger -- the only way to emit a
      // ld+json body; escaped above, and never rendered as HTML by the browser.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
