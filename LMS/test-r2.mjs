// Memory-only R2 substitute for local regression tests and preview.
export class MemoryBucket{
 objects=new Map();uploads=new Map();
 async put(key,input){const bytes=input instanceof Uint8Array?input:new Uint8Array(input instanceof ArrayBuffer?input:await new Response(input).arrayBuffer());this.objects.set(key,bytes);return {key,size:bytes.length};}
 async head(key){const b=this.objects.get(key);return b?{size:b.length,httpEtag:'"fixture"'}:null;}
 async get(key,options={}){let b=this.objects.get(key);if(!b)return null;const size=b.length;if(options.range)b=b.slice(options.range.offset,options.range.offset+options.range.length);return {size,body:b,text:async()=>new TextDecoder().decode(b),arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)};}
 async createMultipartUpload(key){const id=crypto.randomUUID();this.uploads.set(id,{key,parts:new Map()});return this.resumeMultipartUpload(key,id);}
 resumeMultipartUpload(key,id){return {uploadId:id,uploadPart:async(n,input)=>{const bytes=new Uint8Array(input),etag='etag-'+n;this.uploads.get(id).parts.set(n,{bytes,etag});return {partNumber:n,etag};},complete:async parts=>{const u=this.uploads.get(id);if(!u)throw Error('NoSuchUpload');const list=parts.map(p=>{const part=u.parts.get(p.partNumber);if(part.etag!==p.etag)throw Error('Bad part');return part.bytes;});const all=new Uint8Array(list.reduce((n,b)=>n+b.length,0));let offset=0;for(const b of list){all.set(b,offset);offset+=b.length;}await this.put(key,all);this.uploads.delete(id);return {size:all.length};},abort:async()=>this.uploads.delete(id)};}
}
