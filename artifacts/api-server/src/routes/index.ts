import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import dogsRouter from "./dogs";
import commandsRouter from "./commands";
import sessionsRouter from "./sessions";
import familyRouter from "./family";
import usersRouter from "./users";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(dogsRouter);
router.use(commandsRouter);
router.use(sessionsRouter);
router.use(familyRouter);
router.use(usersRouter);

export default router;
