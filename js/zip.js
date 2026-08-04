/* zip.js — the smallest ZIP writer that Word will accept.

   A .docx is a ZIP of XML parts. Everything is stored uncompressed (method 0):
   the whole document is ~40 kB of XML, deflating it would save nothing worth
   pulling in a compression library for, and Word reads stored entries happily.

   Layout, per PKZIP APPNOTE:

     [local header + name + data] × n
     [central directory header + name] × n
     [end of central directory]

   The only fiddly parts are that every offset is little-endian, and that each
   central-directory entry has to carry the byte offset of its own local header
   — so entries are written in one pass while recording those offsets. */

/* ---------- CRC32 ---------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/* ---------- byte assembly ---------- */

const utf8 = new TextEncoder();

/** Little-endian writer over a growable list of chunks. */
function makeSink() {
  const chunks = [];
  let length = 0;
  const push = bytes => { chunks.push(bytes); length += bytes.length; };
  return {
    get length() { return length; },
    bytes: push,
    u16(n) { push(new Uint8Array([n & 0xFF, (n >>> 8) & 0xFF])); },
    u32(n) { push(new Uint8Array([n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF])); },
    join() {
      const out = new Uint8Array(length);
      let at = 0;
      for (const c of chunks) { out.set(c, at); at += c.length; }
      return out;
    }
  };
}

/* MS-DOS date/time. Word does not care what this says, but a zero here makes
   some archivers report the file as corrupt, so write a real timestamp. */
function dosDateTime(d = new Date()) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

/**
 * @param {Array<{name: string, data: string|Uint8Array}>} files
 * @returns {Blob} a .docx-ready ZIP
 */
export function zip(files) {
  const out = makeSink();
  const { time, date } = dosDateTime();
  const entries = [];

  for (const file of files) {
    const name = utf8.encode(file.name);
    const data = typeof file.data === 'string' ? utf8.encode(file.data) : file.data;
    const crc = crc32(data);

    entries.push({ name, crc, size: data.length, offset: out.length });

    out.u32(0x04034B50);       // local file header signature
    out.u16(20);               // version needed (2.0)
    out.u16(0x0800);           // flags: bit 11 = names are UTF-8
    out.u16(0);                // method 0 = stored
    out.u16(time); out.u16(date);
    out.u32(crc);
    out.u32(data.length);      // compressed size == uncompressed
    out.u32(data.length);
    out.u16(name.length);
    out.u16(0);                // extra field length
    out.bytes(name);
    out.bytes(data);
  }

  const dirStart = out.length;
  for (const e of entries) {
    out.u32(0x02014B50);       // central directory header signature
    out.u16(20);               // version made by
    out.u16(20);               // version needed
    out.u16(0x0800);
    out.u16(0);
    out.u16(time); out.u16(date);
    out.u32(e.crc);
    out.u32(e.size);
    out.u32(e.size);
    out.u16(e.name.length);
    out.u16(0);                // extra
    out.u16(0);                // comment
    out.u16(0);                // disk number
    out.u16(0);                // internal attributes
    out.u32(0);                // external attributes
    out.u32(e.offset);         // where this entry's local header sits
    out.bytes(e.name);
  }

  /* Measured before the trailer is written — out.length keeps moving as the
     record goes in, so reading it inline would count the trailer's own bytes
     as part of the directory. */
  const dirSize = out.length - dirStart;

  out.u32(0x06054B50);         // end of central directory
  out.u16(0); out.u16(0);      // this disk / disk with the directory
  out.u16(entries.length);
  out.u16(entries.length);
  out.u32(dirSize);
  out.u32(dirStart);
  out.u16(0);                  // comment length

  return new Blob([out.join()], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
}

/** Decode a `data:...;base64,...` URL to raw bytes, for the logo part. */
export function dataUrlToBytes(dataUrl) {
  const base64 = String(dataUrl).slice(String(dataUrl).indexOf(',') + 1);
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
