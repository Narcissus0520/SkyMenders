# Release Legal Checklist

Status: engineering preparation complete; every approval row below remains a release blocker until dated evidence is signed by the named qualified owner. Free distribution and absence of purchases do not waive publishing, privacy, or platform duties.

| Gate                                       | Owner                                  | Required evidence                                                              | Current status                           |
| ------------------------------------------ | -------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------- |
| Operating entity and WeChat account        | Product owner                          | Entity certificate, AppID ownership and secret-store installation              | Blocked: `EXT-001`                       |
| Publishing, filing and game approvals      | Qualified publishing counsel           | Current dated applicability memo and all required approval identifiers         | Blocked: `EXT-003`                       |
| Real-name, anti-addiction and age rating   | Qualified publishing counsel           | Current launch decision, implementation evidence and rating materials          | Blocked: `EXT-003`                       |
| Privacy guide and policies                 | Privacy counsel                        | Approved policy versions reconciled to data/SDK inventories and deployed flows | Blocked: `EXT-003`                       |
| Data rights and account deletion           | Privacy counsel / QA                   | Access, correction, export and deletion test records                           | Blocked: `EXT-003`, `EXT-006`            |
| Data hosting and subprocessors             | Privacy counsel / infrastructure owner | Data location, processor agreements, retention and security review             | Blocked: `EXT-002`, `EXT-003`            |
| Public name and marks                      | Trademark counsel                      | China trademark and platform similarity search plus risk decision              | Blocked: `EXT-004`                       |
| Copyright and asset licenses               | Art/audio owner / counsel              | Complete source, license and review evidence passing asset audit               | Blocked: `EXT-005`                       |
| Customer support, complaints and incidents | Product/legal/operations               | Published contacts, response procedure and on-call ownership                   | Blocked: `EXT-002`, `EXT-003`            |
| Marketing and store claims                 | Product/legal                          | Screenshot/text review proving no competitor association or unsupported claim  | Blocked: `EXT-003`, `EXT-004`, `EXT-005` |
| Current WeChat platform rules              | Product/legal/QA                       | Dated submission checklist and Developer Tools validation                      | Blocked: `EXT-003`, `EXT-006`            |

Required engineering inputs are `PRIVACY_DATA_INVENTORY.md`, `PRIVACY_POLICY_DRAFT.md`, `USER_AGREEMENT_DRAFT.md`, `THIRD_PARTY_SDK_INVENTORY.md`, the asset registry, deletion-flow tests, security documentation and release evidence manifest. These controls do not replace qualified legal, publishing, platform or authority review.
