import * as grpc from "@grpc/grpc-js";

let callbackInvoked = false;
const callCreds = grpc.credentials.createFromMetadataGenerator((params, cb) => {
    console.log("CALLBACK INVOKED!", JSON.stringify(params));
    callbackInvoked = true;
    const meta = new grpc.Metadata();
    meta.add("authorization", "Bearer test-token");
    cb(null, meta);
});
const sslCreds = grpc.credentials.createSsl();
const combined = grpc.credentials.combineChannelCredentials(sslCreds, callCreds);

const client = new grpc.Client(
    "cepmobtoken.prod.c3.volvocars.com.cn:443",
    combined,
    { "grpc.primary_user_agent": "vca-android/5.67.0 grpc-java-okhttp/1.68.0" }
);

const deadline = new Date(Date.now() + 5000);
client.waitForReady(deadline, (err) => {
    if (err) { console.log("waitForReady error:", err.message); return; }
    const meta = new grpc.Metadata();
    meta.add("vin", "LYVUEL1D4PB242129");
    const call = client.makeServerStreamRequest(
        "/services.vehiclestates.exterior.ExteriorService/GetExterior",
        (obj) => Buffer.from(JSON.stringify(obj)),
        (buf) => buf,
        { vin: "LYVUEL1D4PB242129" },
        meta,
    );
    call.on("data", (data) => {
        console.log("DATA rcvd, callback invoked:", callbackInvoked);
        call.cancel(); client.close();
    });
    call.on("error", (err) => {
        console.log("ERROR code=", err.code, "details=", err.details, "callbackInvoked=", callbackInvoked);
        client.close();
    });
    setTimeout(() => { call.cancel(); client.close(); }, 5000);
});
