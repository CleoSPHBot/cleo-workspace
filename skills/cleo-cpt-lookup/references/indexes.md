# Required Indexes for CPT Lookup

## sph_focus
```javascript
db.CptConsolidatedCodeList.createIndex({Code: 1})
db.CptClinicianDescriptor.createIndex({"CPT Code": 1})
db.CMS_HCPC_MASTER.createIndex({hcpc: 1})          // lowercase field name
db.HCPC2025_APR_ANWEB.createIndex({HCPC: 1})        // uppercase field name
```

## hedis_2025_valuesets
```javascript
db["Value Sets to Codes"].createIndex({Code: 1, "Code System": 1})
db["Measures to Value Sets"].createIndex({"Value Set OID": 1})
```
