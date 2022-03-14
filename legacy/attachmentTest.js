const util = require('util');
const fs   = require('fs');
const fsPromises = fs.promises;

const Remedy = require('./remedy-rest-api.js');
let testList = [];
let serverInfo = {
    server:     ,
    protocol:   'https',
    user:       ,
    password:   
};



/*
    insert test functions here
*/
async function testAttachments(){
    let api = await new Remedy(serverInfo).authenticate().catch(function(e){
        throw(`\t[fail]: inline authenticate:\n\t\t${e.toString}`)
    });
    console.log("\t[ok] authenticated")


    let data = await api.getTicket({
        schema:     'ahicox:remedy-rest-api demo:data',
        fields:     ['Entry ID', 'Item Name', 'Long Description', 'PictureAttachment'],
        ticket:     'DATA-0000000506',
        fetchAttachments: true
    }).catch(function(e){
        throw(`[getTicket fail]: ${e.toString}`);
    });
    console.log(`[ok] getTicket -> complete response:\n\n:${util.inspect(data, false, null)}`);

    // k ... lets try to get it
    let att = await api.getAttachment({
        schema:     'ahicox:remedy-rest-api demo:data',
        fieldName:  'PictureAttachment',
        ticket:     'DATA-0000000506'
    }).catch(function(e){
        throw(`[getAttachment fail]: ${e.toString}`);
    });

    console.log(`[ok] getAttachment -> attachment recieved: ${att.length} bytes type is: ${typeof(att)}`);
    await fsPromises.writeFile(`./tmp.jpg`, att);

    // let's see if query can do it
    console.log()
    api.debug = true;
    let res = await api.query({
        schema:         'ahicox:remedy-rest-api demo:data',
        fields:         ['Entry ID', 'Item Name', 'Long Description', 'PictureAttachment'],
        QBE:            `'1' != $NULL$`,
        fetchAttachments: true
    }).catch(function(e){
        throw(`[query] fail: ${e.toString}`);
    });
    console.log(`[ok] query -> \n\n${util.inspect(res, false, null)}`);


    // it's all good
    return({
        status:     true,
        message:    "attachment tests"
    });
}
testList.push(testAttachments)




/*
    execution starts here
*/


// kick off the test suite
runTest(0);


/*
    runTest ------------------------------------------------------
    execute all of the asynchronous tests in the testList in order
    or die tryin' ... like fiddy ...
*/
function runTest(testNumber){
    console.log(`\n[test #${(testNumber + 1)}]`);
    testList[testNumber]().then(function(result){
        if (! result.status){
            console.log(`[test #${(testNumber + 1)}]: did not fail, but did not exit with success. terminating ...`);
            console.log("exiting with error");
            process.exit(1);
        }else{
            console.log(`[OK (test #${(testNumber + 1)})]: ${result.message}`);
            if (testNumber == (testList.length - 1)){
                console.log("[ALL TESTS OK]");
                process.exit(0);
            }else{
                runTest(testNumber + 1);
            }
        }
    }).catch(function(e){
        console.log(`[FAIL (test #${(testNumber + 1)})]: ${e}`);
        console.log("exiting with error");
        process.exit(1);
    });
}
