import { Router, type IRouter } from "express";
import healthRouter from "./health";
import compressRouter from "./compress";
import statsRouter from "./stats";
import adminRouter from "./admin";
import historyRouter from "./history";
import usersRouter from "./users";

const router: IRouter = Router();

router.use(healthRouter);
router.use(compressRouter);
router.use(statsRouter);
router.use(adminRouter);
router.use(historyRouter);
router.use(usersRouter);

export default router;
