import { Router, type IRouter } from "express";
import healthRouter from "./health";
import compressRouter from "./compress";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(compressRouter);
router.use(statsRouter);

export default router;
