/**
 * Helper de Timestamp desacoplado do Firebase para compatibilidade SQL.
 */
export class Timestamp {
  seconds: number;
  nanoseconds: number;

  constructor(seconds: number, nanoseconds: number = 0) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }

  toDate(): Date {
    return new Date(this.seconds * 1000 + Math.floor(this.nanoseconds / 1000000));
  }

  toISOString(): string {
    return this.toDate().toISOString();
  }

  static fromDate(date: Date): Timestamp {
    return new Timestamp(Math.floor(date.getTime() / 1000), (date.getTime() % 1000) * 1000000);
  }

  static now(): Timestamp {
    return Timestamp.fromDate(new Date());
  }
}
