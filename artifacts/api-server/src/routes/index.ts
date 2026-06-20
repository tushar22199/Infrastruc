import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/authMiddleware";
import healthRouter from "./health";
import authRouter from "./auth";
import inspectionsRouter from "./inspections";
import dashboardRouter from "./dashboard";
import notificationsRouter from "./notifications";
import { activityRouter } from "./activity";
import { assignRouter } from "./assign";
import { commentsRouter } from "./comments";
import { hotspotsRouter } from "./hotspots";
import { overdueRouter } from "./overdue";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);

//router.use(requireAuth);

router.use(inspectionsRouter);
router.use(dashboardRouter);
router.use(notificationsRouter);
router.use(activityRouter);
router.use(assignRouter);
router.use(commentsRouter);
router.use(hotspotsRouter);
router.use(overdueRouter);

export default router;
