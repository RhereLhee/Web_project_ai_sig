-- FREE PLAN: daily signal observation log
-- COUNT(*) per date powers the visible "X / 10" counter shown to free users.

CREATE TABLE "FreeSignalObservation" (
    "id" TEXT NOT NULL,
    "date" VARCHAR(10) NOT NULL,
    "symbol" TEXT NOT NULL,
    "entryTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FreeSignalObservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FreeSignalObservation_date_symbol_entryTime_key"
    ON "FreeSignalObservation"("date", "symbol", "entryTime");

CREATE INDEX "FreeSignalObservation_date_idx"
    ON "FreeSignalObservation"("date");
