import mongoose, { Schema } from "mongoose";
import { ROLES, STATUSES } from "@creditsea/shared";
const detailSchema = new Schema(
  {
    fullName: String,
    pan: String,
    dateOfBirth: String,
    monthlySalaryPaise: Number,
    employmentMode: String,
  },
  { _id: false },
);
const slipSchema = new Schema(
  {
    originalFilename: String,
    storageKey: String,
    mimeType: String,
    sizeBytes: Number,
    uploadedAt: Date,
  },
  { _id: false },
);
const reasonSchema = new Schema(
  { field: String, code: String, message: String },
  { _id: false },
);
export const User = mongoose.model(
  "User",
  new Schema(
    {
      fullName: { type: String, required: true },
      email: { type: String, required: true, unique: true, lowercase: true },
      passwordHash: { type: String, required: true, select: false },
      role: { type: String, enum: ROLES, required: true },
      lastLoginAt: Date,
    },
    { timestamps: true },
  ),
);
export const Draft = mongoose.model(
  "ApplicationDraft",
  new Schema(
    {
      borrowerId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        unique: true,
        required: true,
      },
      personalDetails: detailSchema,
      eligibility: {
        eligible: Boolean,
        reasons: [reasonSchema],
        checkedAt: Date,
      },
      salarySlip: slipSchema,
      currentStep: { type: Number, default: 2 },
    },
    { timestamps: true },
  ),
);
const paymentSchema = new Schema(
  {
    utr: { type: String, required: true },
    amountPaise: { type: Number, required: true },
    paymentDate: { type: Date, required: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdAt: { type: Date, required: true },
  },
  { _id: true },
);
const loanSchema = new Schema(
  {
    borrowerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    applicationSnapshot: { type: detailSchema, required: true },
    salarySlip: { type: slipSchema, required: true },
    principalPaise: { type: Number, required: true },
    tenureDays: { type: Number, required: true },
    annualInterestRatePercent: { type: Number, required: true },
    interestPaise: { type: Number, required: true },
    totalRepaymentPaise: { type: Number, required: true },
    paidAmountPaise: { type: Number, default: 0 },
    status: { type: String, enum: STATUSES, required: true },
    rejectionReason: String,
    appliedAt: Date,
    sanctionedAt: Date,
    sanctionedBy: Schema.Types.ObjectId,
    rejectedAt: Date,
    rejectedBy: Schema.Types.ObjectId,
    disbursedAt: Date,
    disbursedBy: Schema.Types.ObjectId,
    closedAt: Date,
    payments: [paymentSchema],
  },
  { timestamps: true },
);
loanSchema.index(
  { borrowerId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["APPLIED", "SANCTIONED", "DISBURSED"] },
    },
  },
);
loanSchema.index(
  { "payments.utr": 1 },
  {
    unique: true,
    partialFilterExpression: { "payments.utr": { $exists: true } },
  },
);
loanSchema.index({ status: 1, createdAt: -1 });
export const Loan = mongoose.model("Loan", loanSchema);
