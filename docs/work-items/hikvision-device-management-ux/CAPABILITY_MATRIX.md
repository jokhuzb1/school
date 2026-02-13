# CAPABILITY MATRIX

## Model/Firmware Capability Matrix (Template + Current Observations)

| Capability | ISAPI Path | Behavior | Action Policy |
|---|---|---|---|
| Device Info | `/ISAPI/System/deviceInfo` | Commonly available | Required |
| System Status | `/ISAPI/System/status` | Model-dependent | Optional |
| Time Config | `/ISAPI/System/time` | Often available | Read/Write when supported |
| NTP Servers | `/ISAPI/System/Network/ntpServers` | Firmware-dependent | Read/Write when supported |
| Network Interfaces | `/ISAPI/System/Network/interfaces` | Firmware-dependent | Read/Write when supported |
| System Capabilities | `/ISAPI/System/capabilities` | Not universal | Probe and fallback |

## Runtime Rule
1. Probe capability first.
2. If unsupported: show read-only + reason.
3. Never blind-write unsupported endpoint.
4. Save `before` snapshot prior to write.
