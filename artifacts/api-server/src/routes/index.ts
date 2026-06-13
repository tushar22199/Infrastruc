import { Router, type IRouter } from "express";
import healthRouter from "./health";
import inspectionsRouter from "./inspections";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(inspectionsRouter);
router.use(dashboardRouter);

export default router;
