import mongoose from 'mongoose';
export type ISiteTapes = {
    key: string;
    day: {
        title: string;
        lines: {
            betShortId: string;
            optionId: string;
        }[];
    };
    week: {
        title: string;
        lines: {
            betShortId: string;
            optionId: string;
        }[];
    };
};
export declare const SiteTapes: mongoose.Model<{
    key: string;
    day: {
        title: string;
        lines: mongoose.Types.DocumentArray<{
            betShortId: string;
            optionId: string;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
            betShortId: string;
            optionId: string;
        }, {}, {}> & {
            betShortId: string;
            optionId: string;
        }>;
    };
    week: {
        title: string;
        lines: mongoose.Types.DocumentArray<{
            betShortId: string;
            optionId: string;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
            betShortId: string;
            optionId: string;
        }, {}, {}> & {
            betShortId: string;
            optionId: string;
        }>;
    };
} & mongoose.DefaultTimestampProps, {}, {}, {
    id: string;
}, mongoose.Document<unknown, {}, {
    key: string;
    day: {
        title: string;
        lines: mongoose.Types.DocumentArray<{
            betShortId: string;
            optionId: string;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
            betShortId: string;
            optionId: string;
        }, {}, {}> & {
            betShortId: string;
            optionId: string;
        }>;
    };
    week: {
        title: string;
        lines: mongoose.Types.DocumentArray<{
            betShortId: string;
            optionId: string;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
            betShortId: string;
            optionId: string;
        }, {}, {}> & {
            betShortId: string;
            optionId: string;
        }>;
    };
} & mongoose.DefaultTimestampProps, {
    id: string;
}, {
    timestamps: true;
}> & Omit<{
    key: string;
    day: {
        title: string;
        lines: mongoose.Types.DocumentArray<{
            betShortId: string;
            optionId: string;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
            betShortId: string;
            optionId: string;
        }, {}, {}> & {
            betShortId: string;
            optionId: string;
        }>;
    };
    week: {
        title: string;
        lines: mongoose.Types.DocumentArray<{
            betShortId: string;
            optionId: string;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
            betShortId: string;
            optionId: string;
        }, {}, {}> & {
            betShortId: string;
            optionId: string;
        }>;
    };
} & mongoose.DefaultTimestampProps & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    key: string;
    day: {
        title: string;
        lines: mongoose.Types.DocumentArray<{
            betShortId: string;
            optionId: string;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
            betShortId: string;
            optionId: string;
        }, {}, {}> & {
            betShortId: string;
            optionId: string;
        }>;
    };
    week: {
        title: string;
        lines: mongoose.Types.DocumentArray<{
            betShortId: string;
            optionId: string;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
            betShortId: string;
            optionId: string;
        }, {}, {}> & {
            betShortId: string;
            optionId: string;
        }>;
    };
} & mongoose.DefaultTimestampProps, mongoose.Document<unknown, {}, {
    key: string;
    day: {
        title: string;
        lines: mongoose.Types.DocumentArray<{
            betShortId: string;
            optionId: string;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
            betShortId: string;
            optionId: string;
        }, {}, {}> & {
            betShortId: string;
            optionId: string;
        }>;
    };
    week: {
        title: string;
        lines: mongoose.Types.DocumentArray<{
            betShortId: string;
            optionId: string;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
            betShortId: string;
            optionId: string;
        }, {}, {}> & {
            betShortId: string;
            optionId: string;
        }>;
    };
} & mongoose.DefaultTimestampProps, {
    id: string;
}, Omit<mongoose.DefaultSchemaOptions, "timestamps"> & {
    timestamps: true;
}> & Omit<{
    key: string;
    day: {
        title: string;
        lines: mongoose.Types.DocumentArray<{
            betShortId: string;
            optionId: string;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
            betShortId: string;
            optionId: string;
        }, {}, {}> & {
            betShortId: string;
            optionId: string;
        }>;
    };
    week: {
        title: string;
        lines: mongoose.Types.DocumentArray<{
            betShortId: string;
            optionId: string;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
            betShortId: string;
            optionId: string;
        }, {}, {}> & {
            betShortId: string;
            optionId: string;
        }>;
    };
} & mongoose.DefaultTimestampProps & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, unknown, {
    key: string;
    day: {
        title: string;
        lines: mongoose.Types.DocumentArray<{
            betShortId: string;
            optionId: string;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
            betShortId: string;
            optionId: string;
        }, {}, {}> & {
            betShortId: string;
            optionId: string;
        }>;
    };
    week: {
        title: string;
        lines: mongoose.Types.DocumentArray<{
            betShortId: string;
            optionId: string;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
            betShortId: string;
            optionId: string;
        }, {}, {}> & {
            betShortId: string;
            optionId: string;
        }>;
    };
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>, {
    key: string;
    day: {
        title: string;
        lines: mongoose.Types.DocumentArray<{
            betShortId: string;
            optionId: string;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
            betShortId: string;
            optionId: string;
        }, {}, {}> & {
            betShortId: string;
            optionId: string;
        }>;
    };
    week: {
        title: string;
        lines: mongoose.Types.DocumentArray<{
            betShortId: string;
            optionId: string;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
            betShortId: string;
            optionId: string;
        }, {}, {}> & {
            betShortId: string;
            optionId: string;
        }>;
    };
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>;
export declare function getOrCreateSiteTapes(): Promise<ISiteTapes>;
//# sourceMappingURL=SiteTapes.d.ts.map