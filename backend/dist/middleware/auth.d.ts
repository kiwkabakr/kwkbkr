import { Request, Response, NextFunction } from 'express';
export interface AuthRequest extends Request {
    adminId?: string;
}
export declare function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void;
export declare function requireBotKey(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=auth.d.ts.map