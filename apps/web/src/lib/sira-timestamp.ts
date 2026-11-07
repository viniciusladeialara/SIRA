export class Timestamp {
  seconds: number;
  nanoseconds: number;

  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }

  static now(): Timestamp {
    return Timestamp.fromDate(new Date());
  }

  static fromDate(date: Date): Timestamp {
    const millis = date.getTime();
    const seconds = Math.floor(millis / 1000);
    const nanoseconds = (millis % 1000) * 1e6;
    return new Timestamp(seconds, nanoseconds);
  }

  static fromMillis(milliseconds: number): Timestamp {
    const seconds = Math.floor(milliseconds / 1000);
    const nanoseconds = (milliseconds % 1000) * 1e6;
    return new Timestamp(seconds, nanoseconds);
  }

  toDate(): Date {
    return new Date(this.seconds * 1000 + this.nanoseconds / 1e6);
  }

  toMillis(): number {
    return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6);
  }

  toISOString(): string {
    return this.toDate().toISOString();
  }

  isEqual(other: Timestamp): boolean {
    return this.seconds === other.seconds && this.nanoseconds === other.nanoseconds;
  }

  valueOf(): string {
    return this.toISOString();
  }
}
