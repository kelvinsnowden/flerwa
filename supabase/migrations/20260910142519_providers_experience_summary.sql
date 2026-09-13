alter table providers add column experience_summary text;
comment on column providers.experience_summary is 'Seller-authored: years of experience, past work, qualifications. Free text — no fake/pre-filled portfolio.';
