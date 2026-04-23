"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
const zod_1 = require("zod");
function validate(schema, source = 'body') {
    return (req, res, next) => {
        try {
            ;
            req[source] = schema.parse(req[source]);
            next();
        }
        catch (err) {
            if (err instanceof zod_1.ZodError) {
                res.status(400).json({ error: 'Validation failed', details: err.issues });
                return;
            }
            next(err);
        }
    };
}
//# sourceMappingURL=validate.js.map