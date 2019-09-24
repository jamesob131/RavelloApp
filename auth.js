
/*
    Version 1.0.1
    Before running this example, install necessary dependencies by running:
    npm install http-signature jssha
*/

var fs = require('fs');
var https = require('https');
var os = require('os');
var httpSignature = require('http-signature');
var jsSHA = require("jssha");


// TODO: update these values to your own
var tenancyId = "ocid1.tenancy.oc1..aaaaaaaa5txfxrudc5ezitovlpjznw6b3l6sqvkzddepsfu4es2i4x2xyeia";
var authUserId = "ocid1.user.oc1..aaaaaaaadkhtevjlqvxntm4r3lr2rcciwa7pidceycrihtf2j5e6zrwr3bgq";
var keyFingerprint = "1c:d7:5b:30:44:9a:b3:1e:a3:79:6f:f2:bb:24:1e:5a";
var privateKeyPath = "~/.ssh/oci_api_key.pem";

var ravelloCompartment = "ocid1.compartment.oc1..aaaaaaaa2264jgrsligkfvinfkiaob23zn3yrdvtlmxer6axz2h3mz53t2ca";


var identityDomain = "identity.us-ashburn-1.oraclecloud.com";
var coreServicesDomain = "iaas.us-ashburn-1.oraclecloud.com";


if(privateKeyPath.indexOf("~/") === 0) {
    privateKeyPath = privateKeyPath.replace("~", os.homedir())
}
var privateKey = fs.readFileSync(privateKeyPath, 'ascii');


// signing function as described at https://docs.cloud.oracle.com/Content/API/Concepts/signingrequests.htm
function sign(request, options) {

    var apiKeyId = options.tenancyId + "/" + options.userId + "/" + options.keyFingerprint;

    var headersToSign = [
        "host",
        "date",
        "(request-target)"
    ];

    var methodsThatRequireExtraHeaders = ["POST", "PUT"];

    if(methodsThatRequireExtraHeaders.indexOf(request.method.toUpperCase()) !== -1) {
        options.body = options.body || "";

        var shaObj = new jsSHA("SHA-256", "TEXT");
        shaObj.update(options.body);

        request.setHeader("Content-Length", options.body.length);
        request.setHeader("x-content-sha256", shaObj.getHash('B64'));

        headersToSign = headersToSign.concat([
            "content-type",
            "content-length",
            "x-content-sha256"
        ]);
    }

    httpSignature.sign(request, {
        key: options.privateKey,
        keyId: apiKeyId,
        headers: headersToSign
    });

    var newAuthHeaderValue = request.getHeader("Authorization").replace("Signature ", "Signature version=\"1\",");
    request.setHeader("Authorization", newAuthHeaderValue);
}

// generates a function to handle the https.request response object
function handleRequest(callback) {

    return function(response) {
        var responseBody = "";

        response.on('data', function(chunk) {
        responseBody += chunk;
    });

        response.on('end', function() {
            callback(JSON.parse(responseBody));
        });
    }
}

// gets the user with the specified id
function getUser(userId, callback) {

    var options = {
        host: identityDomain,
        path: "/20160918/users/" + encodeURIComponent(userId),
    };

    var request = https.request(options, handleRequest(callback));

    sign(request, {
        privateKey: privateKey,
        keyFingerprint: keyFingerprint,
        tenancyId: tenancyId,
        userId: authUserId
    });

    request.end();
};

// creates a Oracle Cloud Infrastructure VCN in the specified compartment
function createVCN(compartmentId, displayName, cidrBlock, callback) {
    
    var body = JSON.stringify({
        compartmentId: compartmentId,
        displayName: displayName,
        cidrBlock: cidrBlock
    });

    var options = {
        host: coreServicesDomain,
        path: '/20160918/vcns',
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
        }
    };

    var request = https.request(options, handleRequest(callback));

    sign(request, {
        body: body,
        privateKey: privateKey,
        keyFingerprint: keyFingerprint,
        tenancyId: tenancyId,
        userId: authUserId
    });

    request.end(body);
};

// Get information about the instance
function getInstance(instanceId, callback){
    
    var options = {
        host: coreServicesDomain,
        path: '/20160918/instances/' + encodeURIComponent(instanceId) ,
        method: 'GET'
    };

    var request = https.request(options, handleRequest(callback));

    sign(request, {
        privateKey: privateKey,
        keyFingerprint: keyFingerprint,
        tenancyId: tenancyId,
        userId: authUserId
    });

    request.end();
};

//Stop the specified instance
//TODO: get it working
function stopInstance(instanceId, callback){
    
    
    var body = JSON.stringify({
        action: "SOFTSTOP"
    });

    var options = {
        host: coreServicesDomain,
        path: '/20160918/instances/' + encodeURIComponent(instanceId) ,
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
        }
    };

    var request = https.request(options, handleRequest(callback));

    sign(request, {
        body: body,
        privateKey: privateKey,
        keyFingerprint: keyFingerprint,
        tenancyId: tenancyId,
        userId: authUserId
    });

    request.end();
};

function deleteInstance(instanceId, callback){
    
    var options = {
        host: coreServicesDomain,
        path: '/20160918/instances/' + encodeURIComponent(instanceId) ,
        method: 'DELETE',
        headers: {
            "Content-Type": "application/json",
        }
    };

    var request = https.request(options, handleRequest(callback));

    sign(request, {
        privateKey: privateKey,
        keyFingerprint: keyFingerprint,
        tenancyId: tenancyId,
        userId: authUserId
    });

    request.end();
};

// Create and launch an instance 
function createInstance(compartmentId, displayName, callback) {
    
    var body = JSON.stringify({
        //Hard coded AD
        availabilityDomain: "WSQk:US-ASHBURN-AD-3",
        compartmentId: compartmentId,
        displayName: displayName,
        createVnicDetails: {
            assignPublicIp: true,
            subnetId: "ocid1.subnet.oc1.iad.aaaaaaaa7yvjiryympifoxuscb3asxegoiotc2c5vl52srg2yzohc4xrvuba"
        } ,
        sourceDetails: {
            sourceType: "image",
            bootVolumeSizeInGBs: 50,
            imageId: "ocid1.image.oc1.iad.aaaaaaaafswkvu4a4fbkf3jnxsidjpdur244uwzn42mx47vdbs4vkp344yia"
        } ,
        shape: "VM.Standard2.1"
    });

    var options = {
        host: coreServicesDomain,
        path: '/20160918/instances',
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
        }
    };

    var request = https.request(options, handleRequest(callback));

    sign(request, {
        body: body,
        privateKey: privateKey,
        keyFingerprint: keyFingerprint,
        tenancyId: tenancyId,
        userId: authUserId
    });

    request.end(body);
};

// Create a compartment
function createCompartmnet(compartmentId, displayName, callback) {
    
    var body = JSON.stringify({
        compartmentId: compartmentId,
        displayName: displayName,
    });

    var options = {
        host: identityDomain,
        path: '/20160918/compartments/',
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
        }
    };

    var request = https.request(options, handleRequest(callback));

    sign(request, {
        body: body,
        privateKey: privateKey,
        keyFingerprint: keyFingerprint,
        tenancyId: tenancyId,
        userId: authUserId
    });

    request.end(body);
};

// test the above functions
//console.log("GET USER:");
/*
getUser(authUserId, function(data) {
    console.log(data);
        
    console.log("\nCREATING VCN:");

    // TODO: replace this with a compartment you have access to
    var compartmentIdToCreateVcnIn = ravelloCompartment;

    createVCN(compartmentIdToCreateVcnIn, "Test-VCN", "10.0.0.0/16", function(data) {
        console.log(data);
    });
});
*/

/*
createInstance(ravelloCompartment, "TestInstance", function(data){
    console.log(data);
});
*/

//Get instance info
createInstance(ravelloCompartment, "inst2", function(data) {
    console.log(data);
});


//Ubuntu image OCID: ocid1.image.oc1.iad.aaaaaaaafswkvu4a4fbkf3jnxsidjpdur244uwzn42mx47vdbs4vkp344yia