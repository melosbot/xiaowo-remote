import path from "node:path";
import { fileURLToPath } from "node:url";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import {
  GRPC_MAIN_HOST,
  GRPC_LBS_HOST,
  GRPC_USER_AGENT,
  GRPC_TIMEOUT_MS,
} from "./client-profile.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROTO_DIR = path.resolve(__dirname, "..", "proto");

function readVarint(buf: Buffer, offset: number): [number, number] {
  let result = 0;
  let shift = 0;
  let pos = offset;
  while (pos < buf.length) {
    const byte = buf[pos];
    result |= (byte & 0x7f) << shift;
    pos++;
    if ((byte & 0x80) === 0) return [result >>> 0, pos];
    shift += 7;
    if (shift > 35) throw new Error("varint too long");
  }
  throw new Error("varint truncated");
}

function parseLocationRaw(buf: Buffer): {
  vin: string;
  longitude: number;
  latitude: number;
} {
  let offset = 0;
  const out: { vin: string; longitude: number; latitude: number } = {
    vin: "",
    longitude: 0,
    latitude: 0,
  };
  while (offset < buf.length) {
    let tag: number;
    [tag, offset] = readVarint(buf, offset);
    const fieldNum = tag >>> 3;
    const wireType = tag & 0x07;
    if (wireType === 0) {
      [, offset] = readVarint(buf, offset);
    } else if (wireType === 1) {
      if (fieldNum === 2) out.longitude = buf.readDoubleLE(offset);
      if (fieldNum === 3) out.latitude = buf.readDoubleLE(offset);
      offset += 8;
    } else if (wireType === 2) {
      let len: number;
      [len, offset] = readVarint(buf, offset);
      if (fieldNum === 1)
        out.vin = buf.subarray(offset, offset + len).toString("utf8");
      offset += len;
    } else if (wireType === 5) {
      offset += 4;
    } else {
      break;
    }
  }
  return out;
}

function encodeVarint(value: number): Buffer {
  const bytes: number[] = [];
  let v = value;
  while (v > 0x7f) {
    bytes.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  bytes.push(v & 0x7f);
  return Buffer.from(bytes);
}

function encodeLocationReq(vin: string): Buffer {
  const vinBytes = Buffer.from(vin, "utf8");
  const tag = Buffer.from([0x0a]);
  const len = encodeVarint(vinBytes.length);
  return Buffer.concat([tag, len, vinBytes]);
}

const LOADER_OPTIONS = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
};

function loadProto(file: string) {
  return protoLoader.loadSync(path.join(PROTO_DIR, file), LOADER_OPTIONS);
}

const exteriorPkg = grpc.loadPackageDefinition(loadProto("exterior.proto"));
const healthPkg = grpc.loadPackageDefinition(loadProto("health.proto"));
const fuelPkg = grpc.loadPackageDefinition(loadProto("fuel.proto"));
const invocationPkg = grpc.loadPackageDefinition(loadProto("invocation.proto"));
const odometerPkg = grpc.loadPackageDefinition(loadProto("odometer.proto"));
const availabilityPkg = grpc.loadPackageDefinition(
  loadProto("availability.proto"),
);
const dtlinternetPkg = grpc.loadPackageDefinition(
  loadProto("dtlinternet.proto"),
);
const enginePkg = grpc.loadPackageDefinition(
  loadProto("engineremotestart.proto"),
);
const carPreferencesPkg = grpc.loadPackageDefinition(
  loadProto("car_preferences.proto"),
);
const parkingClimatizationPkg = grpc.loadPackageDefinition(
  loadProto("parkingclimatization.proto"),
);
const preCleaningPkg = grpc.loadPackageDefinition(
  loadProto("precleaning.proto"),
);

type ServiceCtor = new (
  address: string,
  credentials: grpc.ChannelCredentials,
  options?: Record<string, unknown>,
) => any;

type ServiceWithDef = ServiceCtor & { service: Record<string, MethodDef> };

function service(pkg: grpc.GrpcObject, path: string[]): ServiceWithDef {
  let cur: any = pkg;
  for (const p of path) cur = cur[p];
  return cur as ServiceWithDef;
}

const ExteriorService = service(exteriorPkg as grpc.GrpcObject, [
  "services",
  "vehiclestates",
  "exterior",
  "ExteriorService",
]);
const HealthService = service(healthPkg as grpc.GrpcObject, [
  "services",
  "vehiclestates",
  "health",
  "HealthService",
]);
const FuelService = service(fuelPkg as grpc.GrpcObject, [
  "services",
  "vehiclestates",
  "fuel",
  "FuelService",
]);
const OdometerService = service(odometerPkg as grpc.GrpcObject, [
  "services",
  "vehiclestates",
  "odometer",
  "OdometerService",
]);
const AvailabilityService = service(availabilityPkg as grpc.GrpcObject, [
  "services",
  "vehiclestates",
  "availability",
  "AvailabilityService",
]);
const DtlInternetService = service(dtlinternetPkg as grpc.GrpcObject, [
  "dtlinternet",
  "DtlInternetService",
]);
const EngineRemoteStartService = service(enginePkg as grpc.GrpcObject, [
  "services",
  "vehiclestates",
  "engineremotestart",
  "EngineRemoteStartService",
]);
const CarPreferencesService = service(carPreferencesPkg as grpc.GrpcObject, [
  "car_preferences",
  "CarPreferences",
]);
const ParkingClimatizationService = service(
  parkingClimatizationPkg as grpc.GrpcObject,
  [
    "services",
    "vehiclestates",
    "parkingclimatization",
    "ParkingClimatizationService",
  ],
);
const PreCleaningService = service(preCleaningPkg as grpc.GrpcObject, [
  "services",
  "vehiclestates",
  "precleaning",
  "PreCleaningService",
]);
const InvocationService = service(invocationPkg as grpc.GrpcObject, [
  "invocation",
  "InvocationService",
]);

type MethodDef = grpc.MethodDefinition<any, any>;

function md(Ctor: ServiceWithDef, name: string): MethodDef {
  return Ctor.service[name];
}

const METHODS = {
  GetExterior: md(ExteriorService, "GetExterior"),
  GetHealth: md(HealthService, "GetHealth"),
  GetFuel: md(FuelService, "GetFuel"),
  GetOdometer: md(OdometerService, "GetOdometer"),
  GetAvailability: md(AvailabilityService, "GetAvailability"),
  GetEngineRemoteStart: md(EngineRemoteStartService, "GetEngineRemoteStart"),
  StreamLastKnownLocations: md(DtlInternetService, "StreamLastKnownLocations"),
  GetPreferences: md(CarPreferencesService, "GetPreferences"),
  GetParkingClimatization: md(
    ParkingClimatizationService,
    "GetParkingClimatization",
  ),
  GetPreCleaning: md(PreCleaningService, "GetPreCleaning"),
  WindowControl: md(InvocationService, "WindowControl"),
  EngineStart: md(InvocationService, "EngineStart"),
  HonkFlash: md(InvocationService, "HonkFlash"),
  Lock: md(InvocationService, "Lock"),
  Unlock: md(InvocationService, "Unlock"),
  TailgateControl: md(InvocationService, "TailgateControl"),
  SunroofControl: md(InvocationService, "SunroofControl"),
  PreCleaningStart: md(InvocationService, "PreCleaningStart"),
  PreCleaningStop: md(InvocationService, "PreCleaningStop"),
  UpdateStatus: md(InvocationService, "UpdateStatus"),
} as const;

export class InvocationError extends Error {}

const SUCCESS_STATUSES = new Set(["SUCCESS", "SENT", "DELIVERED"]);

function raiseInvocationFail(status: string): void {
  switch (status) {
    case "CAR_OFFLINE":
      throw new InvocationError("车辆当前离线，请稍后重试");
    case "DELIVERY_TIMEOUT":
    case "RESPONSE_TIMEOUT":
      throw new InvocationError("车辆响应超时，请稍后重试");
    case "UNKNOWN_CAR_ERROR":
      throw new InvocationError("车辆暂时无法执行此操作");
    case "NOT_ALLOWED_PRIVACY_ENABLED":
      throw new InvocationError("请先在沃尔沃汽车 App 中同意车辆隐私协议");
    case "NOT_ALLOWED_WRONG_USAGE_MODE":
      throw new InvocationError("当前车辆状态不支持此操作");
    case "NOT_ALLOWED_CONFLICTING_INVOCATION":
      throw new InvocationError("车辆正在执行其他操作，请稍后重试");
    default:
      throw new InvocationError("操作未完成，请稍后重试");
  }
}

function firstStreamMessage(
  call: grpc.ClientReadableStream<any>,
  label: string,
  timeoutMs = GRPC_TIMEOUT_MS,
): Promise<any> {
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        call.cancel();
        reject(new Error("车辆服务响应超时"));
      }
    }, timeoutMs);

    call.on("data", (resp: any) => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        call.cancel();
        resolve(resp);
      }
    });
    call.on("error", (err: any) => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        console.error(
          `[gRPC] ${label} error: code=${err.code} details=${err.details}`,
        );
        reject(err);
      }
    });
    call.on("end", () => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve(null);
      }
    });
  });
}

export class VehicleGrpcAPI {
  private mainClient: grpc.Client | null = null;
  private lbsClient: grpc.Client | null = null;
  private invocationStub: any = null;
  private creds: grpc.ChannelCredentials | null = null;

  constructor(private tokenProvider: () => string) {}

  private buildCredentials(): grpc.ChannelCredentials {
    const callCreds = grpc.credentials.createFromMetadataGenerator(
      (_params, callback) => {
        const token = this.tokenProvider().trim();
        const meta = new grpc.Metadata();
        meta.add("authorization", `Bearer ${token}`);
        callback(null, meta);
      },
    );
    const sslCreds = grpc.credentials.createSsl();
    return grpc.credentials.combineChannelCredentials(sslCreds, callCreds);
  }

  private getCredentials(): grpc.ChannelCredentials {
    if (!this.creds) this.creds = this.buildCredentials();
    return this.creds;
  }

  private getMainClient(): grpc.Client {
    if (!this.mainClient) {
      this.mainClient = new grpc.Client(
        GRPC_MAIN_HOST,
        this.getCredentials(),
        {
          "grpc.primary_user_agent": GRPC_USER_AGENT,
          "grpc.accept_encoding": "gzip",
          "grpc.keepalive_time_ms": 60_000,
          "grpc.keepalive_timeout_ms": 20_000,
          "grpc.keepalive_permit_without_calls": 1,
          "grpc.min_reconnect_backoff_ms": 1_000,
          "grpc.max_reconnect_backoff_ms": 10_000,
        },
      );
    }
    return this.mainClient;
  }

  private getLbsClient(): grpc.Client {
    if (!this.lbsClient) {
      this.lbsClient = new grpc.Client(GRPC_LBS_HOST, this.getCredentials(), {
        "grpc.primary_user_agent": GRPC_USER_AGENT,
        "grpc.keepalive_time_ms": 60_000,
        "grpc.keepalive_timeout_ms": 20_000,
        "grpc.keepalive_permit_without_calls": 1,
      });
    }
    return this.lbsClient;
  }

  private getInvocationStub(): any {
    if (!this.invocationStub) {
      this.invocationStub = new InvocationService(
        GRPC_MAIN_HOST,
        this.getCredentials(),
        {
          "grpc.primary_user_agent": GRPC_USER_AGENT,
          "grpc.accept_encoding": "gzip",
          "grpc.keepalive_time_ms": 60_000,
          "grpc.keepalive_timeout_ms": 20_000,
          "grpc.keepalive_permit_without_calls": 1,
          "grpc.min_reconnect_backoff_ms": 1_000,
          "grpc.max_reconnect_backoff_ms": 10_000,
        },
      );
    }
    return this.invocationStub;
  }

  private resetInvocationStub(): void {
    try {
      this.invocationStub?.close();
    } catch {
      /* ignore */
    }
    this.invocationStub = null;
  }

  private resetLbsClient(): void {
    try {
      this.lbsClient?.close();
    } catch {
      /* ignore */
    }
    this.lbsClient = null;
  }

  private vinMeta(vin: string): grpc.Metadata {
    const meta = new grpc.Metadata();
    meta.add("vin", vin);
    return meta;
  }

  private async call(
    method: MethodDef,
    host: "main" | "lbs",
    label: string,
    request: any,
    vin: string,
  ): Promise<any> {
    const client = host === "lbs" ? this.getLbsClient() : this.getMainClient();
    await this.waitForReady(client, label);
    const call = client.makeServerStreamRequest(
      method.path,
      method.requestSerialize,
      method.responseDeserialize,
      request,
      this.vinMeta(vin),
    );
    return firstStreamMessage(call, label);
  }

  private callRaw(
    method: MethodDef,
    host: "main" | "lbs",
    label: string,
    request: any,
    vin: string,
  ): Promise<any> {
    const client = host === "lbs" ? this.getLbsClient() : this.getMainClient();
    const call = client.makeServerStreamRequest(
      method.path,
      method.requestSerialize,
      (buf: Buffer) => buf,
      request,
      this.vinMeta(vin),
    );
    return firstStreamMessage(call, label);
  }

  private async waitForReady(
    client: grpc.Client,
    label: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const deadline = new Date(Date.now() + 10_000);
      client.waitForReady(deadline, (err) => {
        if (err) {
          console.error(`[waitForReady] ${label} failed:`, err.message);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async getExterior(vin: string): Promise<any> {
    return this.call(
      METHODS.GetExterior,
      "main",
      `GetExterior/${vin}`,
      { vin },
      vin,
    );
  }
  async getHealth(vin: string): Promise<any> {
    return this.call(
      METHODS.GetHealth,
      "main",
      `GetHealth/${vin}`,
      { vin },
      vin,
    );
  }
  async getFuel(vin: string): Promise<any> {
    return this.call(METHODS.GetFuel, "main", `GetFuel/${vin}`, { vin }, vin);
  }
  async getOdometer(vin: string): Promise<any> {
    return this.call(
      METHODS.GetOdometer,
      "main",
      `GetOdometer/${vin}`,
      { vin },
      vin,
    );
  }
  async getAvailability(vin: string): Promise<any> {
    return this.call(
      METHODS.GetAvailability,
      "main",
      `GetAvailability/${vin}`,
      { vin },
      vin,
    );
  }
  async getEngineStatus(vin: string): Promise<any> {
    return this.call(
      METHODS.GetEngineRemoteStart,
      "main",
      `GetEngineRemoteStart/${vin}`,
      { vin },
      vin,
    );
  }
  async getLocation(vin: string): Promise<any> {
    const reqBytes = encodeLocationReq(vin);
    const meta = this.vinMeta(vin);
    for (const host of ["lbs", "main"] as const) {
      const client =
        host === "lbs" ? this.getLbsClient() : this.getMainClient();
      try {
        await this.waitForReady(client, `Location/${vin}/${host}`);
      } catch {
        continue;
      }
      const call = client.makeServerStreamRequest(
        "/dtlinternet.DtlInternetService/StreamLastKnownLocations",
        (obj: Uint8Array) => Buffer.from(obj),
        (buf: Buffer) => buf,
        reqBytes,
        meta,
      );
      try {
        const buf: Buffer | null = await firstStreamMessage(
          call,
          `Location/${vin}`,
        );
        if (buf && buf.length > 0) {
          const parsed = parseLocationRaw(buf);
          if (parsed.longitude !== 0 || parsed.latitude !== 0) return parsed;
        }
      } catch {
        // LBS host may reject due to proxy incompatibility; try main host
      }
    }
    return null;
  }
  async getPreferences(vin: string): Promise<any> {
    return this.call(
      METHODS.GetPreferences,
      "main",
      `GetPreferences/${vin}`,
      { vin },
      vin,
    );
  }
  async getParkingClimatization(vin: string): Promise<any> {
    return this.call(
      METHODS.GetParkingClimatization,
      "main",
      `GetParkingClimatization/${vin}`,
      { vin },
      vin,
    );
  }
  async getPreCleaning(vin: string): Promise<any> {
    return this.call(
      METHODS.GetPreCleaning,
      "main",
      `GetPreCleaning/${vin}`,
      { vin },
      vin,
    );
  }

  async getParkingClimatizationRaw(vin: string): Promise<any> {
    const r = await this.getParkingClimatization(vin);
    console.log(
      `[debug] GetParkingClimatization raw: ${JSON.stringify(r).slice(0, 1000)}`,
    );
    return r;
  }

  private async invoke(
    method: MethodDef,
    label: string,
    req: any,
    vin: string,
  ): Promise<void> {
    const methodName = method.path.split("/").pop() ?? "";
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const stub = this.getInvocationStub();
        const call = stub[methodName](req, this.vinMeta(vin), {
          deadline: Date.now() + GRPC_TIMEOUT_MS,
        });
        const resp = await firstStreamMessage(call, label);
        const status = resp?.data?.status;
        console.log(`[invoke] ${label} status=${status}`);
        if (!SUCCESS_STATUSES.has(status)) raiseInvocationFail(status);
        return;
      } catch (e: any) {
        const code = e?.code;
        console.error(
          `[invoke] ${label} attempt=${attempt + 1} code=${code} details=${e?.details ?? e?.message}`,
        );
        if (code === 14 && attempt === 0) {
          this.resetInvocationStub();
          await new Promise((r) => setTimeout(r, 800));
          continue;
        }
        if (code === 14 || e?.message === "Channel has been shut down") {
          throw new InvocationError("车辆服务暂时不可用，请稍后重试");
        }
        throw e;
      }
    }
  }

  async windowControl(vin: string, openType: "OPEN" | "CLOSE"): Promise<void> {
    await this.invoke(
      METHODS.WindowControl,
      `WindowControl/${vin}`,
      { head: { vin }, openType },
      vin,
    );
  }
  async engineControl(
    vin: string,
    isStart: boolean,
    duration: number,
  ): Promise<void> {
    const req = isStart
      ? { head: { vin }, isStart, startDurationMin: duration }
      : { head: { vin }, isStart };
    await this.invoke(METHODS.EngineStart, `EngineStart/${vin}`, req, vin);
  }
  async honkFlash(
    vin: string,
    type: "HONK" | "FLASH" | "HONK_AND_FLASH",
  ): Promise<void> {
    await this.invoke(
      METHODS.HonkFlash,
      `HonkFlash/${vin}`,
      { head: { vin }, honkFlashType: type },
      vin,
    );
  }
  async lock(vin: string): Promise<void> {
    await this.invoke(
      METHODS.Lock,
      `Lock/${vin}`,
      { head: { vin }, lockType: "LOCK_REDUCED_GUARD" },
      vin,
    );
  }
  async unlock(
    vin: string,
    unlockType: "UNLOCK_UNSPECIFIED" | "TRUNK_ONLY" = "UNLOCK_UNSPECIFIED",
  ): Promise<void> {
    await this.invoke(
      METHODS.Unlock,
      `Unlock/${vin}`,
      { head: { vin }, unlockType },
      vin,
    );
  }
  async tailgateControl(vin: string, type: "OPEN" | "CLOSE"): Promise<void> {
    await this.invoke(
      METHODS.TailgateControl,
      `TailgateControl/${vin}`,
      { head: { vin }, type },
      vin,
    );
  }
  async sunroofControl(vin: string, type: "OPEN" | "CLOSE"): Promise<void> {
    await this.invoke(
      METHODS.SunroofControl,
      `SunroofControl/${vin}`,
      { head: { vin }, type },
      vin,
    );
  }
  async preCleaningStart(vin: string): Promise<void> {
    await this.invoke(
      METHODS.PreCleaningStart,
      `PreCleaningStart/${vin}`,
      { head: { vin } },
      vin,
    );
  }
  async preCleaningStop(vin: string): Promise<void> {
    await this.invoke(
      METHODS.PreCleaningStop,
      `PreCleaningStop/${vin}`,
      { head: { vin } },
      vin,
    );
  }
  async updateStatus(vin: string): Promise<void> {
    await this.invoke(
      METHODS.UpdateStatus,
      `UpdateStatus/${vin}`,
      { head: { vin } },
      vin,
    );
  }

  close(): void {
    try {
      this.mainClient?.close();
    } catch {
      /* ignore */
    }
    try {
      this.lbsClient?.close();
    } catch {
      /* ignore */
    }
    try {
      this.invocationStub?.close();
    } catch {
      /* ignore */
    }
    this.mainClient = null;
    this.lbsClient = null;
    this.invocationStub = null;
    this.creds = null;
  }
}
