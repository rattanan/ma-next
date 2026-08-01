# Route inventory

## Routing convention

With Yii's default routing, `FooBarController::actionBaz()` maps to `index.php?r=foo-bar/baz`; module routes add the module prefix (for example, `api/order/index` and `portal/analytics/maintenance`). The web configuration that could alter URL rules is absent, so these are inferred canonical route IDs, not verified public URLs.

The common browser action set is:

`index`, `print`, `view?id=`, `printview?id=`, `create`, `copy?id=`, `update?id=`, `delete?id=`, `deleteall`.

Most generated controllers declare an empty `VerbFilter` action map. Therefore HTTP methods for browser mutations are not reliably constrained in controller code. Route-level RBAC may exist in missing configuration/database data.

## Browser controller groups

The following controller IDs expose the common set unless an exception is noted.

| Area | Controller route IDs | Extra or differing actions |
|---|---|---|
| Alarm import/config | `amimp010`, `amimp020`, `amisu010`, `amisu011`, `amisu012`, `amisu013`, `amisu020`, `amisu030`, `amisu031`, `amisu040`, `amisu050`, `amisu060`, `amisu070` | `amimp010/load`; `amisu010/approve`, `/new`, `/run` |
| Alarm runtime | `amlog010`, `amtrg010`, `amtrg020`, `amtrg030`, `amtrg040`, `amtrg041`, `amtrg050` | `amtrg010/ackall` |
| Knowledge | `arart010`, `arart011`, `arcat010` | `arart010/list`, `/preview`, numeric actions `/1`–`/4` |
| Assets | `asast010`, `asast011`, `asast012`, `asast020`, `asast030`, `asast031`, `asbom010`, `asbom020` | `asast010/diagram`, `/tree`, `/rotateleft`, `/rotateright`, numeric `/1`–`/6`; `asast030/sales`, `/op`, `/cbm`, `/pm`, `/pmmm`, `/pmme`, `/pmmi`, `/add` |
| Asset config/contracts/meters | `ascnf010`, `ascnf011`, `ascnf020`, `ascnt010`, `ascnt011`, `ascnt020`, `ascnt030`, `asmet010`, `asmet020` | `ascnf020/ip`, `/vlan`, `/password`; `ascnt010/legal`, `/others` |
| Common/finance | `calcu010`, `cmcom010`, `cmcom011`, `cmcom020`, `fnact010`, `fnact020`, `fnact021`, `fnact030`, `fnact040`, `fnprd010` | Common set |
| HR | `hrdpt010`, `hrexp010`, `hrexp020`, `hrexp030`, `hrpay010`, `hrpay011`, `hrpay020`, `hrpay021`, `hrpos010`, `hrreq010`, `hrsta010` | `hrreq010/complete`, `/result`, `/pdf` |
| Vehicle | `ofvhc010`, `ofvhc011`, `ofvhc012` | Common set |
| Operations | `opchr010`, `opdas010`, `opdas020`, `opgrp010`, `opgrp011`, `opgrp020`, `opgrp030`, `optag010`, `optag012`, `optag013`, `optag060`, `optrd010`, `optrd020`, `optrd030` | `opdas010/preview`, `/preplant`; `opgrp010/present`; `opgrp020/updatepos`; `opgrp030/updatepos`; `optrd010/preview` |
| Projects | `pjprj010`, `pjprj011`, `pjprj012`, `pjprj013`, `pjprj014`, `pjprj020`, `pjprj021`, `pjprj022`, `pjprj023` | `pjprj010/dashboard`, `/gantt`, `/data`, `/board`; `pjprj020/add`, `/createsubtask`, `/updatestatus`, numeric `/1`–`/5` |
| Purchase orders | `pupod010`, `pupod011`, `pupod012`, `pupod020`, `pupod030` | `pupod010/new`, `/pdf`, `/copypr`, `/cancel`, `/release`, `/approve`; `pupod020` has no bulk delete |
| Purchase requests | `puprd010`, `puprd011`, `puprd020`, `puprd030`, `puprd040` | `puprd010/new`, `/pdf`, `/pdf2`, `/cancel`, `/release`, `/approve`; `puprd020` has no bulk delete |
| Sales/payments | `seord010`, `seord011`, `seord020`, `seord030`, `seord040`, `seord050`, `seord060`, `sepay010` | `seord011` and `seord060`: basic five-action CRUD only; `sepay010/approve` |
| Customer/survey | `slcal010`, `slcus010`, `slcus011`, `slsuv010`, `slsuv020`, `slsuv021`, `slsuv022`, `slsuv030` | Common set |
| Inventory/warehouse | `sparepart`, `tag`, `whbom010`, `whdlv010`, `whinv010`, `whinv020`, `whitm010`, `whitm011`, `whitm012`, `whitm020`, `whitm030`, `whitm031`, `whitm032`, `whitm040`, `whitm041`, `whitm042`, `whitm050`, `whitm051`, `whitm052`, `whvnd010`, `whvnd020` | `whinv020/in`, `/out`, `/adjustin`, `/adjustout`; `whitm010/fieldtool`, `/measurementtool`, `/specialtool`, `/rotateleft`, `/rotateright`; `whitm030/pdf`, `/copyissue`; `whitm040/pdf`; `whitm050/pdf` |
| Maintenance notifications | `wonof010`, `wonof011`, `wonof012`, `wonof020` | `wonof010/new`, `/mm`, `/me`, `/mi`, `/approve`, `/notapprove` |
| Work orders | `wocau010`, `woesc010`, `woimp010`, `woman010`, `woord010`, `woord011`, `woord012`, `woord020`, `woord021`, `woord030`, `woord040`, `woord050`, `woord051`, `woord052`, `woord060`, `woord070`, `woprm010`, `wopvm010`, `wopvm020`, `wopvm021`, `wopvm022`, `wopvm023`, `wosol010` | `woimp010/create` import plus list/view/delete; `woman010/createuser`; `woord010/execute`, `/closed`, `/backlog`, `/open`, `/assigned`, `/printtool`, `/printstock`, `/convert`; `woord011/line`; `woord020/line`; `woord050/prepare`, `/execute`; `woord060/addtool`; `wopvm010/line` |
| System/admin | `sys-api-keys`, `sys-api-tokens`, `sys-approve-details`, `sys-approve-history`, `sys-approves`, `sys-chat-details`, `sys-chats`, `sys-codes`, `sys-configs`, `sys-import`, `sys-lang-translations`, `sys-langs`, `sys-log-details`, `sys-logs`, `sys-notifications`, `sys-report-parameters`, `sys-reports`, `sys-tasks`, `user-profiles`, `ufile010` | `sys-approve-details/test`, `/waiting`, `/history`, `/approve`; `sys-import/import`; `sys-notifications/line`; `sys-reports/survey`, `/vitual`, `/run`; `user-profiles/cert`, `/profile`; `ufile010` contains duplicate create declarations in source |
| Temporary/staging | `tmpbudget`, `tmpevent`, `tmpgois`, `tmpgorc`, `tmpinv`, `tmpprpo` | `tmpbudget/add`; `tmpevent/add`; `tmpinv/test` |
| Miscellaneous | `real-data`, `site` | `site/index`, `/login`, `/logout`, `/contact`, `/about`, `/district`, `/test`; external actions `site/error` and `/captcha`; `real-data` uses common set |

## API module (`api/*`)

All normal API controllers validate a `tokn` query parameter against `sys_api_tokens`; identity actions validate an `auth` API key. Responses are JSON strings. CSRF is disabled after token validation. Upload and non-CRUD action verb constraints are inconsistent.

| Route prefix | Actions |
|---|---|
| `api/identity` | `register` POST, `signin` POST, `signout` POST |
| `api/alert` | `index` GET, `view` GET, `create` POST, `update` POST, `delete` POST |
| `api/asset` | common API CRUD plus `upload` |
| `api/assetcategory` | `index` |
| `api/assetpart` | `index` |
| `api/assettype` | `index` |
| `api/client` | `sendpush`, `signin`, `signout`, `update`, `updateorderdetail`, `create`, `createmeter`, `deletemeter`, `createkeyin`, `createasset`, `createuser`, `deleteuser`, `updateuser` |
| `api/customer` | common API CRUD |
| `api/keyin` | `find` plus common API CRUD |
| `api/location` | common API CRUD plus `upload` |
| `api/meter` | common API CRUD |
| `api/notification` | `approve`, common API CRUD, `upload` |
| `api/order` | `find`, common API CRUD, `pdf`, `updatestatus` |
| `api/orderdetail` | `find` plus common API CRUD |
| `api/part` | common API CRUD plus `upload` |
| `api/parttype` | `index` |
| `api/user` | `stat`, common API CRUD, `upload`, `updatesignature` |
| `api/vendor` | common API CRUD plus `upload` |
| `api/work` | common API CRUD plus `upload` |
| `api/workprior` | `index` |

“Common API CRUD” means `index`, `view`, `create`, `update`, and `delete`.

## Portal and logbook modules

| Route prefix | Actions |
|---|---|
| `portal/alarm` | `monitor`, `summary` |
| `portal/analytics` | `sales`, `maintenance`, `map`, `doc`, `maintenance2`, `op`, `pm`, `inventory`, `survey`, `process`, `woprocess`, `calendar` |
| `portal/chats` | `list`, `read`, `delete`, `view`, `create` |
| `portal/dashboard` | `index`, `present` |
| `portal/data` | `getorder`, `getcustomer`, `getitem`, `whitm030`, `filterevents`, `calendar`, `event`, `orderbyid`, `contract`, `tag`, `severity`, `costcenter`, `costtype`, `allasset`, `wobystatus`, `assetbyparent`, `asset`, `budget`, `status`, `priority`, `project`, `notification`, `wo`, `customername`, `department`, `customernamebyorder`, `bom` |
| `portal/default` | `index`, `upload`, `download` |
| `portal/logs` | `list` |
| `portal/ml` | `index`, `test` |
| `portal/notifications` | `index`, `list`, `read`, `deleteall` |
| `portal/stream` | `gauge`, `trend`, `line`, `alarm`, `chart` |
| `portal/tasks` | common browser CRUD/print set |
| `portal/user-profiles` | `profile` |
| `logbook/default` | `index` |

## Console routes

| Command | Actions | Function |
|---|---|---|
| `yii alarm/index`, `yii alarm/sec` | Alarm scan variants | Run expert-system alarm evaluation. |
| `yii cbm/index` | CBM scan | Read live measurements and create condition events. |
| `yii genevent/index` | Event generation | Turn scheduled asset/PM events into work orders and notifications. |
| `yii hr/resetall` | HR reset | Reset HR-related state; production scheduling is unknown. |
| `yii import/wo` | Work-order import | Process queued/import files. |
| `yii inventory/cal` | Inventory classification | Mark slow/fast-moving or expired stock. |
| `yii hello/index` | Template command | Non-business sample command. |

