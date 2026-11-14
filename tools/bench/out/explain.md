## name_search
```
EXPLAIN
-> Limit: 25 row(s)  (cost=108 rows=25)\n    -> Filter: ((patient.name_normalized like 'sari%') or (patient.name_normalized like '% sari%'))  (cost=108 rows=989)\n        -> Index lookup on patient using patient_tenant_id_created_at_id_index (tenant_id='01a1d9ec-e00c-7330-8a41-f6c05159a797') (reverse)  (cost=108 rows=4712)\n
```

## nik_search
```
EXPLAIN
-> Filter: ((patient.nik_bidx = '8b28e81d9744c9000e4c5b1130fa275290869eaa6f35e3a7c444663b4b200bd2') or (patient.phone_bidx = 'ad2ec8b5a2138cd816bc2410bd1f03df3e401a0e4c3784c090464e3ed98c6e6c'))  (cost=99 rows=895)\n    -> Index lookup on patient using PRIMARY (tenant_id='01a1d9ec-e00c-7330-8a41-f6c05159a797')  (cost=99 rows=4712)\n
```

## patient_pk
```
EXPLAIN
-> Rows fetched before execution  (cost=0..0 rows=1)\n
```

## chart_visits
```
EXPLAIN
-> Index lookup on visit using visit_tenant_id_patient_id_started_at_index (tenant_id='01a1d9ec-e00c-7330-8a41-f6c05159a797', patient_id='01a1d9ec-e016-730d-b9ba-40e7a1a72113') (reverse)  (cost=11.1 rows=12)\n
```

## chart_findings
```
EXPLAIN
-> Sort: tooth_finding.finalized_at, tooth_finding.id  (cost=81.6 rows=96)\n    -> Filter: (tooth_finding.state in ('draft','final'))  (cost=81.6 rows=96)\n        -> Index lookup on tooth_finding using tooth_finding_tenant_id_patient_id_tooth_index (tenant_id='01a1d9ec-e00c-7330-8a41-f6c05159a797', patient_id='01a1d9ec-e016-730d-b9ba-40e7a1a72113')  (cost=81.6 rows=96)\n
```

## chart_findings_heavy
```
EXPLAIN
-> Sort: tooth_finding.finalized_at, tooth_finding.id  (cost=272 rows=320)\n    -> Filter: (tooth_finding.state in ('draft','final'))  (cost=272 rows=320)\n        -> Index lookup on tooth_finding using tooth_finding_tenant_id_patient_id_tooth_index (tenant_id='01a1d9ec-e00c-7330-8a41-f6c05159a797', patient_id='01a1d9ec-e013-7238-bf01-4f9272b163fa')  (cost=272 rows=320)\n
```

## schedule
```
EXPLAIN
-> Sort: appointment.starts_at\n    -> Stream results  (cost=5982 rows=653)\n        -> Nested loop inner join  (cost=5982 rows=653)\n            -> Filter: ((chair.`active` = 1) and (chair.branch_id = '01a1d9ec-e00e-7087-bd9d-996bb59202a1'))  (cost=1.11 rows=1)\n                -> Index lookup on chair using PRIMARY (tenant_id='01a1d9ec-e00c-7330-8a41-f6c05159a797')  (cost=1.11 rows=5)\n            -> Filter: ((appointment.chair_id = chair.id) and (appointment.starts_at < TIMESTAMP'2026-11-14 17:00:00') and (appointment.ends_at > TIMESTAMP'2026-11-14 00:00:00'))  (cost=170 rows=653)\n                -> Index lookup on appointment using PRIMARY (tenant_id='01a1d9ec-e00c-7330-8a41-f6c05159a797')  (cost=170 rows=58762)\n
```

## audit_90d
```
EXPLAIN
-> Limit: 100 row(s)  (cost=1.74 rows=1)\n    -> Index range scan on audit_event using audit_event_tenant_id_entity_type_entity_id_occurred_at_index over (tenant_id = '01a1d9ec-e00c-7330-8a41-f6c05159a797' AND entity_type = 'patient' AND entity_id = '01a1d9ec-e016-730d-b9ba-40e7a1a72113' AND '2026-08-16 00:00:00' <= occurred_at) (reverse), with index condition: ((audit_event.tenant_id = '01a1d9ec-e00c-7330-8a41-f6c05159a797') and (audit_event.entity_type = 'patient') and (audit_event.entity_id = '01a1d9ec-e016-730d-b9ba-40e7a1a72113') and (audit_event.occurred_at >= TIMESTAMP'2026-08-16 00:00:00'))  (cost=1.74 rows=1)\n
```

## audit_all
```
EXPLAIN
-> Limit: 100 row(s)  (cost=118 rows=100)\n    -> Index range scan on audit_event using audit_event_tenant_id_entity_type_entity_id_occurred_at_index over (tenant_id = '01a1d9ec-e00c-7330-8a41-f6c05159a797' AND entity_type = 'patient' AND entity_id = '01a1d9ec-e016-730d-b9ba-40e7a1a72113' AND '2016-11-14 00:00:00' <= occurred_at) (reverse), with index condition: ((audit_event.tenant_id = '01a1d9ec-e00c-7330-8a41-f6c05159a797') and (audit_event.entity_type = 'patient') and (audit_event.entity_id = '01a1d9ec-e016-730d-b9ba-40e7a1a72113') and (audit_event.occurred_at >= TIMESTAMP'2016-11-14 00:00:00'))  (cost=118 rows=122)\n
```

## invoice_30d
```
EXPLAIN
-> Limit: 50 row(s)  (cost=130 rows=50)\n    -> Sort: invoice.created_at DESC, invoice.id DESC, limit input to 50 row(s) per chunk  (cost=130 rows=58850)\n        -> Filter: ((invoice.branch_id = '01a1d9ec-e00e-7087-bd9d-996bb59202a1') and (invoice.created_at between '2026-10-15 00:00:00' and '2026-11-14 23:59:59'))  (cost=130 rows=58850)\n            -> Index lookup on invoice using PRIMARY (tenant_id='01a1d9ec-e00c-7330-8a41-f6c05159a797')  (cost=130 rows=58850)\n
```
