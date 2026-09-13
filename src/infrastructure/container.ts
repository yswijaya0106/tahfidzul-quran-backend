import { createPool, Pool } from "./db/pool";
import { config } from "./config";
import { SystemClock } from "./systemClock";
import { BcryptPasswordHasher } from "./auth/bcryptPasswordHasher";
import { JwtTokenService } from "./auth/jwtTokenService";
import { AesFieldEncryptor } from "./auth/aesFieldEncryptor";
import { S3ObjectStorage } from "./storage/s3ObjectStorage";
import { MysqlUserRepository } from "./repositories/mysqlUserRepository";
import { MysqlRefreshTokenRepository } from "./repositories/mysqlRefreshTokenRepository";
import { MysqlLocationRepository } from "./repositories/mysqlLocationRepository";
import { MysqlStudentRepository } from "./repositories/mysqlStudentRepository";
import { MysqlQuranRepository } from "./repositories/mysqlQuranRepository";
import { MysqlAssessmentRepository } from "./repositories/mysqlAssessmentRepository";
import { MysqlActivityRepository } from "./repositories/mysqlActivityRepository";
import { MysqlAuditLogRepository } from "./repositories/mysqlAuditLogRepository";
import { MysqlDashboardRepository } from "./repositories/mysqlDashboardRepository";
import { MysqlIkhtibarRepository } from "./repositories/mysqlIkhtibarRepository";
import { MysqlRefProvinceRepository } from "./repositories/mysqlRefProvinceRepository";
import { MysqlRefCityRepository } from "./repositories/mysqlRefCityRepository";
import { MysqlAngkatanRepository } from "./repositories/mysqlAngkatanRepository";
import { MysqlDailyTargetRepository } from "./repositories/mysqlDailyTargetRepository";

import { LoginUseCase } from "../application/auth/loginUseCase";
import { RefreshUseCase } from "../application/auth/refreshUseCase";
import { LogoutUseCase, LogoutAllUseCase } from "../application/auth/logoutUseCase";
import { UserUseCases } from "../application/users/userUseCases";
import { LocationUseCases } from "../application/locations/locationUseCases";
import { StudentUseCases } from "../application/students/studentUseCases";
import { AssessmentUseCases } from "../application/assessments/assessmentUseCases";
import { ActivityUseCases } from "../application/activities/activityUseCases";
import { QuranUseCases } from "../application/quran/quranUseCases";
import { DashboardUseCases } from "../application/dashboard/dashboardUseCases";
import { FileUseCases } from "../application/files/fileUseCases";
import { IkhtibarUseCases } from "../application/ikhtibar/ikhtibarUseCases";
import { RefDataUseCases } from "../application/refData/refDataUseCases";
import { AngkatanUseCases } from "../application/angkatan/angkatanUseCases";
import { DailyTargetUseCases } from "../application/dailyTargets/dailyTargetUseCases";

export interface Container {
  pool: Pool;
  quranRepository: MysqlQuranRepository;
  userRepository: MysqlUserRepository;
  tokenService: JwtTokenService;
  login: LoginUseCase;
  refresh: RefreshUseCase;
  logout: LogoutUseCase;
  logoutAll: LogoutAllUseCase;
  userUseCases: UserUseCases;
  locationUseCases: LocationUseCases;
  studentUseCases: StudentUseCases;
  assessmentUseCases: AssessmentUseCases;
  activityUseCases: ActivityUseCases;
  quranUseCases: QuranUseCases;
  dashboardUseCases: DashboardUseCases;
  fileUseCases: FileUseCases;
  ikhtibarUseCases: IkhtibarUseCases;
  refDataUseCases: RefDataUseCases;
  angkatanUseCases: AngkatanUseCases;
  dailyTargetUseCases: DailyTargetUseCases;
}

export async function buildContainer(): Promise<Container> {
  const pool = createPool();
  const clock = new SystemClock();
  const passwordHasher = new BcryptPasswordHasher();
  const tokenService = new JwtTokenService(
    config.auth.accessTokenSecret,
    config.auth.accessTokenExpiresIn,
  );
  const fieldEncryptor = new AesFieldEncryptor(config.auth.nikEncryptionKeyHex);
  const objectStorage = new S3ObjectStorage(config.storage);

  const userRepository = new MysqlUserRepository(pool);
  const refreshTokenRepository = new MysqlRefreshTokenRepository(pool);
  const locationRepository = new MysqlLocationRepository(pool);
  const studentRepository = new MysqlStudentRepository(pool);
  const quranRepository = new MysqlQuranRepository(pool);
  const assessmentRepository = new MysqlAssessmentRepository(pool);
  const activityRepository = new MysqlActivityRepository(pool);
  const auditLogRepository = new MysqlAuditLogRepository(pool);
  const dashboardRepository = new MysqlDashboardRepository(pool);
  const ikhtibarRepository = new MysqlIkhtibarRepository(pool);
  const refProvinceRepository = new MysqlRefProvinceRepository(pool);
  const refCityRepository = new MysqlRefCityRepository(pool);
  const angkatanRepository = new MysqlAngkatanRepository(pool);
  const dailyTargetRepository = new MysqlDailyTargetRepository(pool);

  await quranRepository.warmCache();

  return {
    pool,
    quranRepository,
    userRepository,
    tokenService,
    login: new LoginUseCase(
      userRepository,
      refreshTokenRepository,
      auditLogRepository,
      passwordHasher,
      tokenService,
      clock,
      config.auth.refreshTokenTtlDays,
    ),
    refresh: new RefreshUseCase(
      userRepository,
      refreshTokenRepository,
      tokenService,
      clock,
      config.auth.refreshTokenTtlDays,
    ),
    logout: new LogoutUseCase(refreshTokenRepository, auditLogRepository, tokenService, clock),
    logoutAll: new LogoutAllUseCase(refreshTokenRepository, auditLogRepository, clock),
    userUseCases: new UserUseCases(
      userRepository,
      locationRepository,
      auditLogRepository,
      passwordHasher,
      clock,
    ),
    locationUseCases: new LocationUseCases(
      locationRepository,
      auditLogRepository,
      clock,
      objectStorage,
    ),
    studentUseCases: new StudentUseCases(
      studentRepository,
      locationRepository,
      angkatanRepository,
      auditLogRepository,
      fieldEncryptor,
      clock,
      objectStorage,
    ),
    assessmentUseCases: new AssessmentUseCases(
      assessmentRepository,
      studentRepository,
      quranRepository,
      auditLogRepository,
      clock,
      config.assessmentClockSkewMinutes,
    ),
    activityUseCases: new ActivityUseCases(
      activityRepository,
      locationRepository,
      auditLogRepository,
      clock,
      objectStorage,
    ),
    quranUseCases: new QuranUseCases(quranRepository),
    dashboardUseCases: new DashboardUseCases(
      dashboardRepository,
      studentRepository,
      clock,
      objectStorage,
      dailyTargetRepository,
      quranRepository,
    ),
    fileUseCases: new FileUseCases(objectStorage),
    ikhtibarUseCases: new IkhtibarUseCases(
      ikhtibarRepository,
      studentRepository,
      auditLogRepository,
      clock,
      config.assessmentClockSkewMinutes,
    ),
    refDataUseCases: new RefDataUseCases(refProvinceRepository, refCityRepository),
    angkatanUseCases: new AngkatanUseCases(
      angkatanRepository,
      locationRepository,
      auditLogRepository,
      clock,
    ),
    dailyTargetUseCases: new DailyTargetUseCases(dailyTargetRepository, quranRepository),
  };
}
