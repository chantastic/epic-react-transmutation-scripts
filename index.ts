import {program} from "commander"
import migrate_exercise from "./modules/migrate_exercise"

program
	.name("epicreact-migrate")
	.description("Migrate Epic React exercises to new workshop-app format.")
	.requiredOption("-p, --path <path>", "path to workshop-app")

program
	.command("migrate-exercise")
	.argument("<exercise_id>", "Exercise id to magrate")
	.action((id) => migrate_exercise({id, path: program.opts().path}))

program.parse()
