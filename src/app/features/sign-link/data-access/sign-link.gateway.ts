import { SignatureSubmission } from '@shared/signature/signature-steps';
import { Observable } from 'rxjs';
import { LinkDocument } from '../domain/models';

/** La firma por enlace: el token del correo es la única credencial. Los fallos llegan como `ApiError`. */
export abstract class SignLinkGateway {
  abstract getDocument(token: string): Observable<LinkDocument>;
  abstract getPdf(token: string): Observable<Blob>;
  abstract requestCode(token: string): Observable<void>;
  abstract sign(token: string, submission: SignatureSubmission): Observable<void>;
}
