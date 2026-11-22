#!/usr/bin/env python3
"""Read amplifier and IR slot names from a NANOCORE pedal. No project files needed.

Save this file anywhere, run ``python3 fetch-amp-ir-names.py --selftest`` to check
the codec without hardware, then connect the pedal (stop the official app first)
and run one of:

    python3 fetch-amp-ir-names.py                       # auto-detect USB MIDI
    python3 fetch-amp-ir-names.py --device /dev/snd/midiC3D0
    python3 fetch-amp-ir-names.py --ble AA:BB:CC:DD:EE:FF   # needs: pip install bleak

How it works (everything you need is in this file):

  * The names are NOT read from the .ead / .bin model files and are NOT preset
    names. They are stored in the pedal's per-slot metadata records.
  * Query storage info: 0x30 (amp) / 0x50 (IR), empty payload. Bytes 8..11 of
    the 20-byte reply are a little-endian u32 slot count; 12..15 are a size
    limit; 16..17 are the active slot (0xffff = none). Verified pedals report
    38 amp slots (0..37, the drive models are 30..37) and 30 IR slots (0..29).
  * Then query one slot-info record per slot: command 0x36 (amp) / 0x56 (IR),
    payload = one byte, the slot number. The reply payload is exactly 30 bytes:
        byte 0       slot number
        byte 1       present (0/1)
        byte 2       active (0/1)
        bytes 3..6   u32 data size, little endian
        bytes 7..10  u32 CRC-32 of the data, little endian
        bytes 11..12 u16 format id (0x1a1a on a real pedal)
        byte 13      unused / unknown
        bytes 14..29 16-byte ASCII name, trailing spaces and NULs stripped
    The app writes at most 15 characters; the field itself holds 16 bytes.
  * Framing: SysEx F0 7D 4E 43 70 <7-bit-packed payload> F7 to the pedal,
    F0 7D 4E 43 71 ... F7 back. Packing is groups of 7 data bytes preceded by
    one mask byte whose bit i is bit 7 of group byte i. The unpacked request is
    02 (version), sequence u16, command u16, payload length u16, then the
    payload (7 header bytes). The reply has the same header plus one status
    byte before the length u16 (8 header bytes), all little endian.
  * Match replies by (sequence, command). Status must be 0; 0x10/0x11 are
    streamed chunks (u16 total, u16 offset, data) and are reassembled here.
    Other statuses are errors, e.g. 3 = slot out of range, 6 = not ready.
  * Reads are retried up to 3 times on timeout; a lost reply is harmless.
    Never do this with a write command.

USB-MIDI on Linux uses the ALSA raw device node (/dev/snd/midiCxDy), which
allows both writing and reading; "amidi" cannot read replies. You may need to
be in the "audio" group. BLE-MIDI uses the standard service
03b80e5a-ede8-4b33-a751-6ce34ec4c700 and characteristic
7772e5db-3868-4112-a1a9-f2669d106bf3; a BLE packet is two timestamp header
bytes followed by the MIDI bytes, and a long SysEx may span several packets.

Only Python 3.10+ standard library is used for USB. bleak is needed only for
--ble. This program never writes to the pedal.
"""

from __future__ import annotations

import argparse
import asyncio
import glob
import json
import os
import re
import struct
import sys
from typing import Any

SYSEX_PREFIX = bytes.fromhex("f0 7d 4e 43")
HOST_TO_DEVICE = 0x70
DEVICE_TO_HOST = 0x71
SYSEX_END = 0xF7
MAX_SYSEX = 65536

KINDS = {"amp": (0x30, 0x36), "ir": (0x50, 0x56)}
INFO_TIMEOUT = 2.0
SLOT_TIMEOUT = 1.2
READ_ATTEMPTS = 3

BLE_SERVICE_UUID = "03b80e5a-ede8-4b33-a751-6ce34ec4c700"
BLE_CHAR_UUID = "7772e5db-3868-4112-a1a9-f2669d106bf3"

STATUS_TEXT = {
    0: "ok", 1: "bad payload", 2: "no active write session", 3: "slot out of range",
    4: "flash read/write failed", 5: "CRC mismatch", 6: "device not ready",
    0x7E: "command not implemented",
}


# --- byte-level codec -------------------------------------------------------

def pack7(data: bytes) -> bytes:
    """Encode bytes as groups of one high-bit mask plus seven 7-bit bytes."""
    out = bytearray()
    for offset in range(0, len(data), 7):
        group = data[offset:offset + 7]
        mask = sum(((byte >> 7) & 1) << i for i, byte in enumerate(group))
        out.append(mask)
        out.extend(byte & 0x7F for byte in group)
    return bytes(out)


def unpack7(data: bytes) -> bytes:
    """Inverse of pack7."""
    out = bytearray()
    offset = 0
    while offset < len(data):
        mask = data[offset]
        offset += 1
        group = data[offset:offset + 7]
        if not group or mask >= 0x80 or any(byte >= 0x80 for byte in group) or mask >> len(group):
            raise ValueError("malformed 7-bit group")
        out.extend(byte | (((mask >> i) & 1) << 7) for i, byte in enumerate(group))
        offset += len(group)
    return bytes(out)


def encode_request(command: int, payload: bytes, sequence: int) -> bytes:
    raw = struct.pack("<BHHH", 2, sequence, command, len(payload)) + payload
    return SYSEX_PREFIX + bytes((HOST_TO_DEVICE,)) + pack7(raw) + bytes((SYSEX_END,))


def decode_response(message: bytes) -> tuple[int, int, int, bytes] | None:
    """Return (sequence, command, status, payload), or None if not our reply."""
    prefix = SYSEX_PREFIX + bytes((DEVICE_TO_HOST,))
    if not message.startswith(prefix) or not message.endswith(bytes((SYSEX_END,))):
        return None
    raw = unpack7(message[len(prefix):-1])
    if len(raw) < 8 or raw[0] != 2:
        raise ValueError("invalid NANOCORE response header")
    sequence, command = struct.unpack_from("<HH", raw, 1)
    status = raw[5]
    length = int.from_bytes(raw[6:8], "little")
    if len(raw) != 8 + length:
        raise ValueError("response payload length mismatch")
    return sequence, command, status, raw[8:]


def decode_request(message: bytes) -> tuple[int, int, bytes]:
    """Decode a request built by encode_request (useful for test doubles)."""
    prefix = SYSEX_PREFIX + bytes((HOST_TO_DEVICE,))
    if not message.startswith(prefix) or not message.endswith(bytes((SYSEX_END,))):
        raise ValueError("not a NANOCORE request")
    raw = unpack7(message[len(prefix):-1])
    if len(raw) < 7 or raw[0] != 2:
        raise ValueError("invalid NANOCORE request header")
    sequence, command = struct.unpack_from("<HH", raw, 1)
    length = int.from_bytes(raw[5:7], "little")
    if len(raw) != 7 + length:
        raise ValueError("request payload length mismatch")
    return sequence, command, raw[7:]


def parse_storage(payload: bytes) -> tuple[int, int, int | None]:
    if len(payload) < 20:
        raise ValueError("storage info must be at least 20 bytes")
    count = int.from_bytes(payload[8:12], "little")
    limit = int.from_bytes(payload[12:16], "little")
    active = int.from_bytes(payload[16:18], "little")
    if not count or not limit:
        raise ValueError("pedal reports no slots or no capacity")
    return count, limit, None if active == 0xFFFF else active


def parse_slot(payload: bytes, expected_slot: int) -> dict:
    if len(payload) != 30:
        raise ValueError(f"slot record must be 30 bytes, got {len(payload)}")
    slot, present, active = payload[:3]
    if slot != expected_slot:
        raise ValueError(f"reply is for slot {slot}, not {expected_slot}")
    if present not in (0, 1) or active not in (0, 1):
        raise ValueError("invalid slot flags")
    return {
        "slot": slot,
        "present": bool(present),
        "active": bool(active),
        "size": int.from_bytes(payload[3:7], "little"),
        "crc32": int.from_bytes(payload[7:11], "little"),
        "format_id": int.from_bytes(payload[11:13], "little"),
        "name": payload[14:30].decode("ascii", errors="replace").rstrip(" \x00"),
    }


class StreamReassembler:
    """Join status 0x10/0x11 chunked replies into one payload."""

    def __init__(self) -> None:
        self._streams: dict[tuple[int, int], tuple[int, bytearray, bytearray]] = {}

    def feed(self, response: tuple[int, int, int, bytes]) -> tuple[int, int, int, bytes] | None:
        sequence, command, status, payload = response
        if status not in (0x10, 0x11):
            return response
        if len(payload) < 4:
            raise ValueError("truncated streamed response")
        total = int.from_bytes(payload[:2], "little")
        offset = int.from_bytes(payload[2:4], "little")
        chunk = payload[4:]
        key = (sequence, command)
        if key not in self._streams:
            self._streams[key] = (total, bytearray(total), bytearray(total))
        known_total, data, received = self._streams[key]
        if known_total != total or offset + len(chunk) > total:
            raise ValueError("inconsistent streamed response")
        data[offset:offset + len(chunk)] = chunk
        received[offset:offset + len(chunk)] = b"\x01" * len(chunk)
        if status == 0x11:
            if not all(received):
                raise ValueError("final streamed chunk arrived before all data")
            del self._streams[key]
            return sequence, command, 0, bytes(data)
        return None


# --- transports -------------------------------------------------------------

class UsbMidi:
    """ALSA raw MIDI device node: full-duplex SysEx with no extra dependency."""

    def __init__(self, path: str) -> None:
        import asyncio as _asyncio

        self.path = path
        self.fd = os.open(path, os.O_RDWR | os.O_NONBLOCK)
        self.queue: _asyncio.Queue[bytes] = _asyncio.Queue()
        self.buffer = bytearray()
        self.sysex: bytearray | None = None
        _asyncio.get_running_loop().add_reader(self.fd, self._on_readable)

    def _on_readable(self) -> None:
        try:
            chunk = os.read(self.fd, 4096)
        except (BlockingIOError, OSError):
            return
        for byte in chunk:
            if byte >= 0xF8:            # realtime bytes, e.g. active sensing
                continue
            if self.sysex is not None:
                if 0x80 <= byte < 0xF8 and byte not in (0xF0, SYSEX_END):
                    self.sysex = None   # interrupted SysEx, drop it
                    continue
                self.sysex.append(byte)
                if byte == SYSEX_END:
                    self.queue.put_nowait(bytes(self.sysex))
                    self.sysex = None
                elif len(self.sysex) > MAX_SYSEX:
                    self.sysex = None
            elif byte == 0xF0:
                self.sysex = bytearray((byte,))

    async def send(self, message: bytes) -> None:
        os.write(self.fd, message)

    async def recv(self, timeout: float) -> bytes:
        return await asyncio.wait_for(self.queue.get(), timeout)

    def close(self) -> None:
        asyncio.get_running_loop().remove_reader(self.fd)
        os.close(self.fd)


class BleSysexDecoder:
    """Reassemble SysEx from BLE-MIDI notifications, including split packets."""

    def __init__(self) -> None:
        self.sysex: bytearray | None = None

    def feed(self, packet: bytes) -> list[bytes]:
        out: list[bytes] = []
        if len(packet) < 2 or not packet[0] & 0x80:
            return out
        i = 1
        while i < len(packet):
            byte = packet[i]
            if self.sysex is not None and byte < 0x80:
                i = self._consume(packet, i, out)
                continue
            if not byte & 0x80:
                i += 1
                continue
            i += 1                      # timestamp byte
            if i >= len(packet):
                break
            first = packet[i]
            if self.sysex is not None and first < 0x80:
                i = self._consume(packet, i, out)
                continue
            if first == 0xF0:
                self.sysex = bytearray((0xF0,))
                i = self._consume(packet, i + 1, out)
            elif first & 0x80:
                i += 1
                if 0x80 <= first <= 0xEF:
                    i += 1 if (first & 0xE0) in (0xC0, 0xD0) else 2
                elif first in (0xF1, 0xF3):
                    i += 1
                elif first == 0xF2:
                    i += 2
            else:
                i += 1
        return out

    def _consume(self, packet: bytes, i: int, out: list[bytes]) -> int:
        while i < len(packet):
            byte = packet[i]
            if byte >= 0xF8:
                i += 1
                continue
            if byte & 0x80 and byte != SYSEX_END:
                if i + 1 < len(packet) and packet[i + 1] == SYSEX_END:
                    i += 1              # timestamp just before the end of SysEx
                    byte = packet[i]
                else:
                    self.sysex = None
                    return len(packet)
            assert self.sysex is not None
            self.sysex.append(byte)
            i += 1
            if len(self.sysex) > MAX_SYSEX:
                self.sysex = None
                return i
            if byte == SYSEX_END:
                out.append(bytes(self.sysex))
                self.sysex = None
                return i
        return i


class BleMidi:
    """BLE-MIDI transport. Requires: pip install bleak"""

    def __init__(self, client: Any) -> None:
        self.client = client
        self.decoder = BleSysexDecoder()
        self.queue: asyncio.Queue[bytes] = asyncio.Queue()

    @classmethod
    async def connect(cls, address: str) -> "BleMidi":
        from bleak import BleakClient

        client = BleakClient(address)
        await client.connect()
        transport = cls(client)
        await client.start_notify(BLE_CHAR_UUID, transport._notify)
        return transport

    def _notify(self, _sender: Any, data: bytearray | bytes) -> None:
        for message in self.decoder.feed(bytes(data)):
            self.queue.put_nowait(message)

    async def send(self, message: bytes) -> None:
        packet = bytes((0x80, 0x80)) + message   # timestamp 0
        await self.client.write_gatt_char(BLE_CHAR_UUID, packet, response=False)

    async def recv(self, timeout: float) -> bytes:
        return await asyncio.wait_for(self.queue.get(), timeout)

    async def close(self) -> None:
        await self.client.disconnect()


# --- queries ----------------------------------------------------------------

async def query(transport, command: int, payload: bytes, sequence: int,
                timeout: float, assembler: StreamReassembler) -> bytes:
    request = encode_request(command, payload, sequence)
    for attempt in range(READ_ATTEMPTS):
        await transport.send(request)
        deadline = asyncio.get_running_loop().time() + timeout
        while True:
            remaining = deadline - asyncio.get_running_loop().time()
            if remaining <= 0:
                break
            try:
                message = await transport.recv(remaining)
            except TimeoutError:
                break
            response = decode_response(message)
            if response is None or (response[0], response[1]) != (sequence, command):
                continue                     # unrelated MIDI event, ignore it
            assembled = assembler.feed(response)
            if assembled is None:
                continue
            status = assembled[2]
            if status != 0:
                raise RuntimeError(
                    f"command 0x{command:02x}: {STATUS_TEXT.get(status, 'error')} (status 0x{status:02x})"
                )
            return assembled[3]
    raise TimeoutError(f"no reply to command 0x{command:02x} after {READ_ATTEMPTS} attempts")


async def fetch_names(transport, *, all_slots: bool = False) -> dict:
    result: dict[str, list[dict]] = {}
    assembler = StreamReassembler()
    sequence = 0

    for kind, (info_command, slot_command) in KINDS.items():
        sequence = (sequence + 1) & 0xFFFF
        storage = parse_storage(
            await query(transport, info_command, b"", sequence, INFO_TIMEOUT, assembler)
        )
        count, limit = storage[0], storage[1]
        print(f"{kind}: {count} slots, {limit} bytes each", file=sys.stderr)
        entries = []
        for slot in range(count):
            sequence = (sequence + 1) & 0xFFFF
            record = await query(
                transport, slot_command, bytes((slot,)), sequence, SLOT_TIMEOUT, assembler
            )
            info = parse_slot(record, slot)
            if all_slots or info["present"]:
                entries.append(info)
        result[kind] = entries
    return result


def find_usb_device() -> str:
    candidates = sorted(
        path for path in glob.glob("/dev/snd/midiC*D*")
        if re.fullmatch(r"/dev/snd/midiC\d+D\d+", path)
    )
    if not candidates:
        raise SystemExit("no USB MIDI device found; pass --device /dev/snd/midiCxDy")
    if len(candidates) > 1:
        raise SystemExit("several MIDI devices found; choose one with --device: " + ", ".join(candidates))
    return candidates[0]


# --- self-test: no pedal required ------------------------------------------

def selftest() -> None:
    sample = bytes.fromhex("04 01 01 d2 2f 00 00 17 f8 de 31 1a 1a 00") + b"Fd59Bm".ljust(16, b"\x00")

    assert unpack7(pack7(sample)) == sample
    assert encode_request(0x36, bytes((4,)), 1).hex(" ") == (
        "f0 7d 4e 43 70 00 02 01 00 36 00 01 00 00 04 f7"
    )
    info = parse_slot(sample, 4)
    assert (info["name"], info["size"], info["crc32"], info["format_id"]) == (
        "Fd59Bm", 12242, 0x31DEF817, 6682
    )
    try:
        parse_slot(sample, 3)
        raise AssertionError("slot mismatch was accepted")
    except ValueError:
        pass

    raw = struct.pack("<BHHBH", 2, 7, 0x56, 0, len(sample)) + sample
    reply = SYSEX_PREFIX + bytes((DEVICE_TO_HOST,)) + pack7(raw) + bytes((SYSEX_END,))
    assert decode_response(reply) == (7, 0x56, 0, sample)

    decoder = BleSysexDecoder()
    packets = [bytes((0x80, 0x80)) + reply[i:i + 14] for i in range(0, len(reply), 14)]
    assert b"".join(x for p in packets for x in decoder.feed(p)) == reply

    streamed = struct.pack("<BHHBH", 2, 7, 0x56, 0x10, 6) + struct.pack("<HH", 30, 0) + sample[:2]
    end = struct.pack("<BHHBH", 2, 7, 0x56, 0x11, 32) + struct.pack("<HH", 30, 2) + sample[2:]
    def frame(raw: bytes) -> bytes:
        return SYSEX_PREFIX + bytes((DEVICE_TO_HOST,)) + pack7(raw) + bytes((SYSEX_END,))

    first_chunk = decode_response(frame(streamed))
    last_chunk = decode_response(frame(end))
    assert first_chunk is not None and last_chunk is not None
    assembler = StreamReassembler()
    assert assembler.feed(first_chunk) is None
    assert assembler.feed(last_chunk) == (7, 0x56, 0, sample)

    class FakeTransport:
        def __init__(self) -> None:
            self.queue: asyncio.Queue[bytes] = asyncio.Queue()

        async def send(self, message: bytes) -> None:
            sequence, command, payload = decode_request(message)
            if command in (0x30, 0x50):
                data = bytearray(20)
                data[8:12] = (2).to_bytes(4, "little")
                data[12:16] = (4096).to_bytes(4, "little")
                data[16:18] = (0xFFFF).to_bytes(2, "little")
            else:
                slot = payload[0]
                name = ("Fd59Bm", "Eng412A")[slot].encode()
                data = (bytes((slot, 1, 0)) + struct.pack("<II", 12242, 0x31DEF817)
                        + b"\x1a\x1a\x00" + name.ljust(16, b"\x00"))
            raw = struct.pack("<BHHBH", 2, sequence, command, 0, len(data)) + data
            self.queue.put_nowait(
                SYSEX_PREFIX + bytes((DEVICE_TO_HOST,)) + pack7(raw) + bytes((SYSEX_END,))
            )

        async def recv(self, timeout: float) -> bytes:
            return await asyncio.wait_for(self.queue.get(), timeout)

    listing = asyncio.run(fetch_names(FakeTransport()))
    assert [x["name"] for x in listing["amp"]] == ["Fd59Bm", "Eng412A"]
    assert [x["name"] for x in listing["ir"]] == ["Fd59Bm", "Eng412A"]
    print("self-test OK: codec, record parsing, BLE reassembly, streaming, full query flow")


async def run(args: argparse.Namespace) -> dict:
    if args.ble:
        transport = await BleMidi.connect(args.ble)
    else:
        transport = UsbMidi(args.device or find_usb_device())
    try:
        return await fetch_names(transport, all_slots=args.all_slots)
    finally:
        if isinstance(transport, BleMidi):
            await transport.close()
        else:
            transport.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Read amp and IR slot names from a NANOCORE pedal")
    parser.add_argument("--device", help="ALSA raw MIDI node, e.g. /dev/snd/midiC3D0 (auto-detected if omitted)")
    parser.add_argument("--ble", metavar="ADDRESS", help="BLE-MIDI address instead of USB (needs bleak)")
    parser.add_argument("--all-slots", action="store_true", help="include empty slots")
    parser.add_argument("--selftest", action="store_true", help="verify the codec without a pedal")
    args = parser.parse_args()
    if args.selftest:
        selftest()
        return
    print(json.dumps(asyncio.run(run(args)), indent=2))


if __name__ == "__main__":
    main()
