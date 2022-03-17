# remedy-rest-api.js
A zero-dependency Browser or Node client for the BMC Remedy ARS REST service as described here: [BMC Documentation](https://docs.bmc.com/docs/ars2008/overview-of-the-rest-api-929631053.html)

Node compatibility is achieved through use of the [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API). As of `node.js v17.5` the Fetch API is available natively as part of Node Core, however it is behind the `--experimental-fetch` commandline argument. It is expected this feature will have full support in upcoming Node releases, but in the mean time be aware you'll need that flag to use this library in Node.

The previous version of this library was based on the [XHR API](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest), which required an external node module to emulate the `XMLHttpRequest` object. Though mature, the XHR API was quite complicated to use. By moving to Fetch API, it was possible to remove the external dependency in the Node environment, though in doing so the `progressCallback` option on `getTicket()` was deprecated. So if you need to draw a progress indicator on particularly large fetches from the api, you might need to use the older version, which is available in this package under the `./legacy` directory.


## Author / Version
* **Amy Hicox** | `amy@hicox.com` | `amy.hicox@nasa.gov`
* **Version 2.51** | 3/17/2022




## Synopsis
```javascript

// if in node, you'll need to import the module
const RemedyRestAPI = require('./lib/remedy-rest-api.js');


// create object
let Remedy = new RemedyRestAPI({
    protocol:   'https',
    server:     'remedy.hicox.com',
    port:       8443,
    user:       'someUser',
    password:   'd4fs3krT'
});

/*
    if in browser, you're going to need a reverse proxy
    since the browser would disallow any connection not
    on the same hostname and port, which means you'll
    likely need a reverse proxy from the webserver that
    serves code referencing this library, to the jetty
    server on your arserver. You will need to give said
    reverse proxy a path. This is what the `proxyPath`
    argument is for.

    so in the browser, you'll very likely need to specify
    proxyPath
*/

// create object (legit)
let Remedy = new RemedyRestAPI({
    protocol:   window.location.protocol.replace(':', ''),
    server:     window.location.hostname,
    proxyPath:  '/REST',
    user:       'someUser',
    password:   'd4fs3krT'
});

/*
    async authenticate()
    establishes a session to an arserver as the specified user
    returns a promise resolving to self, so that it can be
    chained thusly
*/
let Remedy = await new RemedyRestAPI({
    protocol:   window.location.protocol.replace(':', ''),
    server:     window.location.hostname,
    proxyPath:  '/REST',
    user:       'someUser',
    password:   'd4fs3krT'
}).authenticate();


// query for some tickets
let tickets = await Remedy.query({
    schema:             'demo:recipe',
    fields:             ['Entry ID', 'Name', 'Procedure', 'picPreview'],
    QBE:               `'Name' LIKE "%Cashew%"`,
    getAssociations:    ['demo:recipe to ingredient'],
    expandAssociations: true,
    fetchAttachments:   true
}).catch(function(error){
    console.log(`query failed: ${error}`);
});

// create a ticket
let newTicketEntryID = await Remedy.createTicket({
    schema: 'demo:recipe:ingredient',
    fields: {
        'Name':               'Healthy Boy Brand Mushroom Soy Sauce',
        'Measurement':        '1.5 TBSP',
        'recipe Entry ID':    '000000000000001'
    }
}).catch(function(error){
    console.log(`create failed: ${error}`);
});

// modify a ticket
await Remedy.modifyTicket({
    schema: 'demo:recipe:ingredient',
    ticket: newTicketEntryID,
    fields: {
        'Measurement':        '.5 TBSP',
        'Notes':              'less is more'
    }
}).catch(function(error){
    console.log(`modify failed: ${error}`);
});

// delete a ticket
await Remedy.deleteTicket({
    schema: 'demo:recipe:ingredient',
    ticket: newTicketEntryID
}).catch(function(error){
    console.log(`delete failed: ${error}`);
});
```




## Function reference
above was an overview, here's the details of how it all works.




### `constructor`
Creates a new object. Data on the input object is copied into the object as attribute default values:
```javascript
let Remedy = new RemedyRestAPI({<arbitrary>})
```


----


### `async authenticate({args})`
Establishes a new API session to the specified server as the specified user. Returns a promise resolving to the object reference, such that it can be chained with the constructor. `{args}` can be specified alternately on the object constructor, or on the call to the `authenticate()` function

#### args
* **protocol** `enum('http', 'https')` - protocol to use connecting to REST service

* **server** `string` - hostname to use connecting to REST service

* **port** `integer` - port number to use connecting to REST service (`protocol` determines default ports 80 & 443, only need to specify if non-standard port is used)

* **user** `string` - Remedy 'Login ID' to use connecting to REST service

* **password** `string` - password for Remedy 'Login ID' identified by `user`

* **proxyPath** `string` - perepend this string to the URL prior to the `/api` path string. This allows you to place the ARS REST service behind a reverse proxy on the webserver serving code containing this api library see:
[Apache Documentation](https://httpd.apache.org/docs/2.4/howto/reverse_proxy.html)

```javascript
// from already created object (where 'Remedy' is the previously created object)
let abort = false;
Remedy.authenticate({
    protocol:   window.location.protocol.replace(':', ''),
    server:     window.location.hostname,
    proxyPath:  '/REST',
    user:       'someUser',
    password:   'd4fs3krT'
}).catch(function(e){
    abort = true;
    console.log(`authenticate failed: ${error}`);
}).then(function(api){
    if (! abort){
        // call functions against 'api' here
    }
});

// inline with constructor in async function
let Remedy = await new RemedyRestAPI({
    protocol:   window.location.protocol.replace(':', ''),
    server:     window.location.hostname,
    proxyPath:  '/REST',
    user:       'someUser',
    password:   'd4fs3krT'
}).catch(function(e){
    console.log(`authenticate failed: ${error}`);
});

// call functions against 'Remedy' here
```



----


### `async logout()`
Destroy existing API session on ARServer for specified user (takes no args)

```javascript
await Remedy.logout().catch(function(error){
    console.log(`logout failed: ${error}`)
})
```


----


### `async getAttachment({args})`
retrieves attachment from the specified Attachment field on the specified form and record (data is returned as a raw binary array buffer)

#### args
* **schema** `string` - the name of the Form on the server containing the record with the attachment field you want to retrieve

* **ticket** `string` - the `'Entry ID' (field 1)` value identifying the record on the form identified by `schema` with the attachment field you wish to retrieve

* **fieldName** `string` - the **label** of the attachment field in the **default view** form identified by `schema` (this is unforunately how the ARS REST interface identifies fields -- what happens when two fields have the same label? ask BMC. `Field ID` *should* be supported to end around this ambiguity but isn't, again -- this is BMC's design, not mine :unamused:

```javascript
let data = await Remedy.getAttachment({
    schema:     'demo:recipe',
    ticket:     '000000000000003',
    fieldName:  'picPreview'
}).catch(function(error){
    console.log(`getAttachment failed: ${error}`);
});

```


----


### `async query({args})`
Executes specified query against the specified form, returning values for the specified fields against matching rows.

#### args
* **schema** `string` - name of form on ARServer to query

* **fields** `array` - array of strings representing the **label** of each field in the Default View of the form identified by `schema`, that you wish to retrieve values for across rows matching the specified query

* **QBE** `string` - this is a `QBE String` (more or less an SQL 'where' clause with alternate syntax where field names are wrapped in 'single ticks' and field values are wrapped in "double quotes"). [see bmc documentation](https://docs.bmc.com/docs/ars2008/using-the-query-by-example-method-929628289.html)

* **offset** `integer` - return rows beginning with the integer *after* this number. For instance `offset: 10` would return rows `11-to-?` where `?` is defined as the last matching row or `limit`

* **limit** `integer` - the maximum number of rows to return

* **sort** `string` - this is a string specifying sort order. In general it'll be `fieldName.asc` or `fieldName.desc`, and you can specify multiple fields like `fieldName1.asc,fieldName2.desc`. Documentation is hilariously sparse as usual but here ya go [BMC Sort Order Documentation](https://docs.bmc.com/docs/ars2008/sort-order-for-rest-api-responses-931128587.html)

* **fetchAttachments** `bool` - if true, fetch attachment content for Attachment fields specified in the `fields` array

* **getAssociations** `bool | array` - if set to `boolean true`, this will return a list of all associations defined on the form for the specific record. alternately you can specify an array of strings matching the `name` of associations you want data for (so 'return just these name associations', or 'return all')

* **expandAssociations** `bool` - if `getAssociations` is boolean true, AND this flag is set true, then field data for associated records (for the listed associations in `getAssociaitons` array) are included in results.

```javascript
let result = await Remedy.query({
    schema:             'demo:recipe',
    QBE:                `'Name' LIKE "%Cashew%"`,
    fields:             ['Entry ID', 'Name', 'Procedure', 'picPreview'],
    sort:               'Name.asc',
    fetchAttachments:   true,
    getAssociations:    ['demo:recipe to ingredient'],
    expandAssociations: true
}).catch(function(error){
    console.log(`query failed: ${error}`)
});
```


----



### `async getTicket({args})`
get field values (and optionally Attachments and Associations) for a single row on a single form identified by the `Entry ID (field 1)`. This is essentially `query()` but without sort, paging options and with a hardcoded QBE of `'1' = "${ticket}"`

#### args
* **schema** `string` - the name of the form containing the record identified by `ticket`

* **ticket** `string` - the value of `field 1` (often named `Request ID`, `Entry ID`, or `Ticket Number`) uniquely identifing the row on the form identified by `schema` you wish to retrieve

* **fields** `array` - same as query, an array of strings matching field labels in the default view of the form identified by `schema`

* **fetchAttachments** `bool` - same as query, if true and if an attachment field is specified in the `fields` array, fetch the content of that attachment and return with results

* **getAssociations** `bool | array` - same as query, get all or get only the named associations

* **expandAssociations** `bool` - same as query, if true get field values for specified associations

* **progressCallback** `function` - same as query, if specified, call this function asynchronously on the `progress` event on the XHR dispatching the REST request

```javascript
let result = await Remedy.getTicket({
    schema:             'demo:recipe',
    ticket:             '000000000000003',
    fields:             ['Entry ID', 'Name', 'Procedure', 'picPreview'],
    fetchAttachments:   true,
    getAssociations:    ['demo:recipe to ingredient'],
    expandAssociations: true
})
```



----



### `async createTicket({args})`
create a new record on the specified form with the specified field values. the function returns a string indicating the `Entry ID (field 1)` value from the newly create record (that is, it gives you the ticket number back after creating it)

#### args
* **schema** `string` - the name of the form you wish to create a new record on

* **fields** `object` - an object of the form `{ fieldName: value, ... }`

* **attachments** `object` - an object of the form `{name: fieldName, content: fileContent}` where the `fieldName` corresponds to an Attachment field on the form identified by `schema`. This field must ALSO be present in the `fields` object (where the corresponding value will be the fileName). The `content` should be the file content. If you're sending ASCII (for instance a CSV file), you don't need to set `encoding`. However if you're sending binary data you will need to Base64 encode the data and set it on the `content`, and you will need to set `encoding: 'BASE64'`

NOTE: on Binary Attachments in browser environments. If you're reading from a file input, you'll need to use the `FileReader` API [read about it here](https://developer.mozilla.org/en-US/docs/Web/API/FileReader/readAsDataURL). Specifically you're going to need to lop some BS off the front of the output of `FileReader.readAsDataURL()`. Here's a handy snippet:

```javascript
let fileBase64Content = reader.result.replace(/(.+)base64,/,'');
```

NOTE ALSO: presently this library can only send one attachment per-REST request. In principle, there's no reason this shouldn't work for setting an arbitrary number of attachment fields in one go, however the ARS REST service throws an error when attempting to that. This is an open issue. A work around is to use `createTicket()` then to use `modifyTicket()` to add additional attachments to the record.

#### output
the function returns a datastructure containing the entryId (`field 1`) of the newly created record and the REST resource URL for accessing it
```text.plain
{
    url:     <resource url>,
    entryId: <field 1 value>
}
```

#### example
```javascript
let newTicket = await Remedy.createTicket({
    schema: 'demo:recipe',
    fields: {
        Status:     'Published',
        Title:      'Peanutbutter Sandwich',
        picPreview: 'pb_and_j.png',
        Procedure: `
            combine two parts Bread
            and one part Peanutbutter,
            spread thinly upon the bread
            surface. Consume.
        `
    },
    attachments: {
        picPreview: {
            name:     'pb_and_j.png',
            content:  fileBase64Content,
            encoding: 'BASE64'
        }
    }

}).catch(function(error){
    throw(`createTicket failed: ${error}`);

});
console.log(`created: ${newTicket.entryId}`)
```



----



### `async modifyTicket({args})`
sets given values on specified fields of a specified record on a form.

#### args
* **schema** `string` - the name of the form you wish to create a new record on

* **ticket** `string` - the value of `field 1` (often named `Request ID`, `Entry ID`, or `Ticket Number`) uniquely identifing the row on the form identified by `schema` you wish to modify

* **fields** `object` - an object of the form `{ fieldName: value, ... }`

* **attachments** `object` - an object of the form `{name: fieldName, content: fileContent}` where the `fieldName` corresponds to an Attachment field on the form identified by `schema`. See notes on `createTicket()`

```javascript
await Remedy.modifyTicket({
    schema: 'demo:recipe',
    ticket: '000000000000003',
    fields: {
        Title: `PB and J`
    }
}).catch(function(error){
    throw(`modifyTicket failed: ${error}`);
})
```



----



### `async deleteTicket({args})`
deletes the row identified by `'1' = "${ticket}"` on the form identified by `schema`

```javascript
await Remedy.deleteTicket({
    schema: 'demo:recipe',
    ticket: '000000000000003'
}).catch(function(error){
    throw(`deleteTicket failed: ${error}`);
});
```


----



### `async mergeData({args})`

```javascript
let ticketIdentifier = await api.mergeData({
    schema:                 formName,
    fields:                 {fieldOne:valueOne, fieldTwo:valueTwo ...},
    QBE:                    qualification,          // (optional)
    handleDuplicateEntryId: enum,                   // error | create | overwrite | merge | alwaysCreate (default error)
    ignorePatterns:         bool,                   // (default false)
    ignoreRequired:         bool,                   // (default false)
    workflowEnabled:        bool,                   // (default true)
    associationsEnabled:    bool,                   // (default true)
    multimatchOption:       enum                    // error | useFirstMatching (default error)
}).catch(function(e){
    throw(`merge failed! ${e}`);
});
console.log(`I merged data into: ${ticketIdentifier.entryId}`);
```

OK, what does mergeData() do? Are you familiar with the BMC Data Import tool? This API call is basically the back-end to that. This function allows you to take a set of field values and a form and say "go update it or make it".

As usual, the [BMC Documentation](https://docs.bmc.com/docs/ars1805/mergeentry-formname-804716415.html) is ... *lacking* ... so most of what I've got going on here, I had to reverse engineer by trial and error.

Let's start with` "how does it know whether to make a new one or update an existing one?"`.
As far as I can tell, it knows this by one of two methods:

1. if you included the fieldName for the field with fieldId 1 (i.e. the "ticket number", "request id", "entry id"), in the **fields** argument, and the *value for that field* matches an existing record, then it will try to update that record (depending on **handleDuplicateEntryId** more on that in a minute).

2. if you specified a **QBE** qualification that matched one or more rows (depending on **multimatchOption**). If that's the case, AND you've got **handleDuplicateEntryId** set to something other than error THEN it will ignore 'entryId' in **fields** (if you have one there) and it will update the single record identified by **QBE**. If the record identified by **QBE** has a different 'entryId', it's just gonna silently dump it from **fields**

ok so that's how it figures out the existing record to update, and if all that fails, it just makes a new one with a couple exceptions:

* if **handleDuplicateEntryId** is set to "error", it's just gonna throw an error
* if **handleDuplicateEntryId** is set to "alwaysCreate", it's just gonna always create one

#### args

* **fields** `object` - an object containing field names and values `see createTicket()`

* **QBE** `string` - Remedy Qualification String `see query()`. Find records matching this QBE qualification and update one of them or error.

* **multimatchOption** `enum(error, useFirstMatching)` - if not specified, defaults to "error". In the case where `QBE` is specified, this indicates how to handle things if more than one record is matched. Obviously a value of `"error"` will throw, and a value of `"useFirstMatching"` means just treat the first result like it was the only result.

* **handleDuplicateEntryId** `enum(error, create, overwrite, merge, alwaysCreate)`

  * `error`
    throw an error if `QBE` or an 'entryId' on `fields` matches an existing record

  * `create`
    if `QBE` is specified and either matches an existing record or no records, OR if `fields` contains an 'entryId' value that DOES match an existing record create a new record with the given field values. If 'entryId' IS specified BUT does not match any existing value, create a new record on the specified schema with the given field values AND use that value for 'entryId'

  * `overwrite`
    if `QBE` is specified and either matches an existing record OR if `fields` contains an 'entryId' value that DOES match an existing record, delete the existing record from the database and replace it wholesale with the given field values. This one is insidious, in that it is quite easy to blow away create date / modify date, etc unintentionally. *Be careful with this one mmmm'kay?*

  * `merge`
    if `QBE` is specified and either matches an existing record OR if `fields` contains an 'entryId' value that DOES match an existing record, update the existing record with the given field values, leaving all other fields in place. **EXCEPT NOT FOR REQUIRED FIELDS**. You must supply a value for ALL required fields on this. If you leave 'em null, you're gonna get the "can't reset required field to null" error. For non-required fields it works pretty much like `modifyTicket()`.

  * `alwaysCreate`
    just forget everything and make a new entryId for it. Yes, even if you have `QBE` set and it matches something, or if you have an 'entryId' in `fields`.

#### output
the function returns a promise resolving to an object of this form:
```javascript
{
    url:     <resource url>,
    entryId: <field 1 value>
}
```
see notes on `createTicket()`

#### example
```javascript
let ticketId = await Remedy.mergeData({
   schema:                 'demo:recipe',
   handleDuplicateEntryId: "error",
   fields: {
       'Entry ID':  'BOGUS-000000001',
       'Title':     'cowabunga dudes!'
   }    
}).catch(function(error){
   throw(`mergeData failed: ${error}`);
});
console.log(`merged data onto ${ticketId.entryId}`);
```



----



### `async getFormOptions({args})`
*I do not understand what this is, but it [appears in the API](https://docs.bmc.com/docs/ars2002/endpoints-in-ar-rest-api-909638176.html) so I made a wrapper for it in the library*

```javascript
let result = await Remedy.getFormOptions({
    schema: 'demo:recipe'
}).catch(function(error){
    throw(`getFormOptions failed: ${error}`);
});
```



----



### `async getMenu({args})`
returns meta-data about the ARS Menu object identified by `name`. To get the actual menu content,
see `getMenuValues()`. See also strangely complete and helpful [BMC Documentation](https://docs.bmc.com/docs/ars2002/example-of-using-the-rest-api-to-retrieve-menu-details-909638136.html)

#### args
* **name** `string` -  the name of the ARS menu object for which you'd like to retrieve meta-data from the server

#### output
the function returns a promise resolving to a data structure of this form:
```javascript
{
    menu_type: 'Search',
    refresh_code: 1,
    qualification_string: `'Status' = "published"`,
    menu_information: {
        qualification_current_fields: [ fieldID, ...],
        qualification_keywords: [keyWord, ...]
    }
}
```
##### `qualification_string`
contains the verbatim QBE in the menu definition so I guess you could parse it if ya wanted I guess

##### `qualification_current_fields`
contains an array of the field_id's you can replace in the qualification this array will be null if you have a menu with no qualification replacement inputs

##### `qualification_keywords`
seems to be the same thing for keywords

##### `menu_information.menu_type` values
a string corresponding to the menu type in Dev Studio
* **Sql**
* **Search**
* **File**
* **DataDictionary**
* **List** - (this is a 'Character Menu' in Dev Studio)

##### `menu_unformation.refresh_code` values
an integer corresponding to these values from Dev Studio
1. On Connect
2. On Open
3. On 15 Minute Intervales

#### example
```javascript
let menu = await Remedy.getMenu({
    name: 'demo:ingredient:Name'
}).catch(function(error){
    throw(`getMenu failed: ${error}`);
})

```



----



### `async getMenuValues({args})`
retrieve values for the ARS Menu object item identified by `name`

#### args
* **name** `string` - the name of the ARS menu object for which you'd like to retrieve values from the server

* **qualification_substitute_info** `object` -
this object specifies value substitutions for the QBE driving the specified menu. However, there's not a whole lot of detail in the [BMC Documentation](https://docs.bmc.com/docs/ars2002/example-of-using-the-rest-api-to-retrieve-menu-details-909638136.html?focusedCommentId=1041165129#comment-1041165129). This is the example object form given in the documentation:
```javascript
qualification_substitute_info: {
    form_name: "TestForm_dfb88",
    field_values: {
      "536870915": 100
    },
    keyword_values: {
      "USER": "Demo"
    }
}
```
`form_name` needs to be the form owning the field values that you wish to replace in the qualification. For instance if you've got a menu with a qualification like this from the recipe demo:

    * **[primary ui form]**           demo:recipe
    * **[supporting table form]**     demo:recipe:ingredient

    now say on your primary form you have a field: `536870919`, and on a menu you have a qualification like this: `'recipe Entry ID' = $536870919$` where 'recipe Entry ID' is the foreign key on your supporting table that links the rows to the parent

    NOW ... say you want to retrieve the ingredient list for the demo:recipe row where `'1' = "000000000000003"`

    this will work:
    ```javascript
    qualification_substitute_info: {
        form_name: 'demo:recipe',
        field_values: {
          '536870919': "000000000000003"
        }
      }
    ```

#### some caveats
1. **you can't use the system field '1' [Entry ID] in the menu qualification**

   it'll work inside ARS, but the API will return an empty string. that's why
   I created a BS field: 536870919. System fields need not apply, but I suspect
   the bug is more sinister ... any field-id replicated between your supposed "calling"
   form (even though the menu would have no concept of that), and your data target form
   gets total confusion server side. I'll guarantee it like the men's warehouse.

2. in the example above, the menu points at `demo:recipe:ingredient`, but you have to specify **the form from which you might call the menu**, which is the form with the field `536870919`, on it that is `demo:recipe`.

#### output
the function returns a promise resolving to an object that has varied forms
```javascript
/*
    here one with two 'Label Fields' specified
*/
{
    items: [
        {
            type:   <SubMenu|?>
            label:  <string menu entry value>,
            content: [
                {
                    type:   <Value|?>
                    label:  <string menu entry value>,
                    value:  <associated value>
                }
            ]
        },
        ...
    ]
}


/*
    basically type gets "SubMenu" or "Value". If there's just one field in the 'Label Fields' section
    it looks like this:
*/
{
    items: [
        {
            type: 'Value',
            label:  <string>
            value: <string>
        }
    ]
}

```

#### example
```javascript
let menuData = await Remedy.getMenuValues({
    name: 'demo:ingredient:Name'
}).catch(function(error){
    throw(`getMenuValues failed: ${error}`);
})
```



----



### `async getFormFields({args})`
get field definitions for the form identified by `schema`. See [BMC Documentation](https://docs.bmc.com/docs/ars2002/endpoints-in-ar-rest-api-909638176.html)

#### args
* **schema** `string` -  name of the form you wish to retrieve field definitions for

* **fetchMenus** `bool` - if set true fetch any menus related to fields on the form

#### output
this function returns a promise resolving to an object of this form:
```javascript
{
    idIndex:    { fieldID:{field_definition} },
    nameIndex:  { fieldName:{field_definition} },
    menus:      { menuName:{menu_definition} }
}
```

* **idIndex** `object` - indexes fields by field ID
* **nameIndex** `object` - indexes fields by fieldName
* **menus** `object` - indexes referenced menus by menuName

```javascript
let formFields = await Remedy.getFormFields({
    schema: 'demo:recipe',
    fetchMenus: true
}).catch(function(error){
    throw(`getFormFields failed: ${error}`);
});
```



----



### `async getRelatedFormsAndMenus({args})`
this retrieves formFields for the form identified by `schema`, and also recurses to find forms related to tables, and menus related to fields

#### args
* **schema** `string` - recursively get fields, forms and menus starting with this form

#### output
the function returns a promise resolving to an object of this form:

```javascript
{
    forms:  {
        schemaName: {
            idIndex:    { fieldID:{field_definition} },
            nameIndex:  { fieldName:{field_definition} },

        }, ...
    },
    menus:  {
        menuName: {arsMenuDef},
        ...
    }
}
```




## Attribute reference
details on all of the object attributes

* **isAuthenticated** `bool` - true, if the object is currently authenticated to the server

* **token** `string` - the API token (if `isAuthenticated` == true)




## Error Handling
all errors are returned as `RemedyRestAPIException` objects. Errors originating from the arserver are not scalar. That is to say for each operation the arserver may return an `array` containing an arbitrary number of errors. In practice, you generally only care about the first error though, so the class will abstract several attributes to reference the *first* error in an array of errors from the server.

`RemedyRestAPIException` have these attributes:

* `messageType` <enum (non-ars | <server defined>) - if the error is not generated from the arserver, but from local code, the value will be non-ars, otherwise this is the `messageType` attribute of the *first* error object returned from the server.

* `message` <string> - this will either be a locally generated error message string (for `messageType: 'non-ars'`), or will be the `messageText` attribute of the *first* error object returned from the server

* `messageText` <string> - this is a hard-coded passthrough to the `messageText` attribute of the *first* error object returned from the server. If no errors returned from server, this value is `null`

* `messageAppendedText` <string> - `null`, or the `messageAppendedText` attribute of the *first* error object returned from the server

* `messageNumber` <int> - `null`, or the `messageNumber` attribute of the \*first* error object returned from the server

* `arsErrorList` <array> - this is an array of error objects returned from the server. Error objects are of the form:
```text.plain
{
    messageType: <str>
    messageText: <str>
    messageAppendedText: <str>
    messageNumber: <int>
}
```

* `thrownByFunction` <string> - name of the RemedyRestAPI class function that threw the error

* `thrownByFunctionArgs` <object> - arguments passed to the RemedyRestAPI class function that threw the error




## Demo & Test

The `./test.js` node script and the `/apiTest.html` browser test require two forms to be installed on the target arserver. These are included in the ./test_data directory in the `RemedyRestAPI-demo-forms-and-menu.def` file. This file contains three objects:

* **[regular form]** RemedyRestAPI:test form
* **[regular form]** RemedyRestAPI:test form2
* **[char menu]** RemedyRestAPI:test menu

Alternately you could edit `./test.js` and `/apiTest.html` to point to forms and menus already installed on your arserver.
