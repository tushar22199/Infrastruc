import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import inspectionsRouter from "./inspections";
import dashboardRouter from "./dashboard";
import notificationsRouter from "./notifications";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(inspectionsRouter);
router.use(dashboardRouter);
router.use(notificationsRouter);

export default router;
