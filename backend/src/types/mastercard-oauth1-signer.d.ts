declare module "mastercard-oauth1-signer" {
  const oauth: { getAuthorizationHeader(uri: string, method: string, payload: string | undefined, consumerKey: string, signingKey: string): string };
  export default oauth;
}

declare module "mastercard-client-encryption" {
  export interface FleConfig {
    paths: { path: string; toEncrypt: { element: string; obj: string }[]; toDecrypt: { element: string; obj: string }[] }[];
    ivFieldName: string;
    encryptedKeyFieldName: string;
    encryptedValueFieldName: string;
    publicKeyFingerprintFieldName: string;
    publicKeyFingerprintType: "certificate" | "publicKey";
    oaepHashingAlgorithmFieldName: string;
    oaepPaddingDigestAlgorithm: "SHA-256" | "SHA-512";
    dataEncoding: "hex" | "base64";
    /** Path to the encryption certificate file. */
    encryptionCertificate: string;
  }
  export class FieldLevelEncryption {
    constructor(config: FleConfig);
    encrypt(endpoint: string, header: unknown, body: unknown): { header: unknown; body: unknown };
    decrypt(response: unknown): unknown;
  }
  const encryption: { FieldLevelEncryption: typeof FieldLevelEncryption };
  export default encryption;
}
