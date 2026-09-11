-- Terminology pass (customer-facing only, per the marketplace-extension
-- brief): the app code was already swept for "Job"/"Provider" in visible
-- copy, but this catalogue text is customer-visible too (service
-- summaries/descriptions on the storefront, checklist item labels shown
-- on the customer's evidence-review screen) and was missed by a
-- code-only grep. Fixing in place — no schema change, just copy.

update services
set summary = replace(summary, 'A provider', 'A professional')
where slug = 'viewed-for-you';

update services
set description = replace(replace(description,
    'The provider attends', 'The professional attends'),
    'A verified provider inspects', 'A verified professional inspects')
where slug in ('viewed-for-you', 'know-before-you-pay');

update services
set description = replace(description, 'the provider collects', 'the professional collects')
where slug = 'document-collection';

update service_checklist_items
set label = replace(replace(label, 'Provider declaration completed', 'Professional declaration completed'),
                     'Provider observations noted', 'Professional observations noted')
where label in ('Provider declaration completed', 'Provider observations noted');

update service_checklist_items
set help_text = replace(help_text, 'Provider affirms', 'Professional affirms')
where help_text like 'Provider affirms%';
