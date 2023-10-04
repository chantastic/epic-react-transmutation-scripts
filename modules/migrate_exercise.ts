import * as fs from "node:fs"
import path from "node:path"
import partial from "lodash/fp/partial"

export default function migrate_exercise({
	id,
	path: project_path,
}: {
	id: number
	path: string
}) {
	function get_legacy_src_path(...segments: string[]) {
		return path.join(shared_path, "src", ...segments)
	}

	let exercise_id = String(id).padStart(2, "0")
	let shared_path = path.join(import.meta.url, "../..", project_path)
	let new_exercises_path = path.join(shared_path, "exercises")

	let new_exercise_path = path.join(
		new_exercises_path,
		`${exercise_id}.UNTITLED`
	)

	function get_new_exercise_path(...segments: string[]) {
		return path.join(new_exercise_path, ...segments)
	}

	let new_exercise_url = new URL(new_exercise_path).pathname

	create_dir(new_exercise_url)

	fs.readdirSync(new URL(get_legacy_src_path("exercise")), {
		withFileTypes: true,
	})
		.filter(
			(file) =>
				file.isFile() &&
				file.name.startsWith(exercise_id) &&
				!file.name.includes("extra-")
		)
		.reduce(function moveExerciseInstructions(acc: fs.Dirent[], file) {
			if (file.name.endsWith(".md")) {
				fs.renameSync(
					new URL(get_legacy_src_path("exercise", file.name)).pathname,
					new URL(get_new_exercise_path("README.mdx")).pathname
				)
				return acc
			}

			return [...acc, file]
		}, [])
		.reduce(function moveExercisePlayground(acc: fs.Dirent[], file) {
			if (!file.name.endsWith(".md")) {
				let get_initial_problem_dir = partial(get_new_exercise_path, [
					"01.problem",
				])

				create_dir(new URL(get_initial_problem_dir()).pathname)

				fs.renameSync(
					new URL(get_legacy_src_path("exercise", file.name)).pathname,
					new URL(
						get_initial_problem_dir(
							`index.${get_suffix_from_file_name(file.name)}`
						)
					).pathname
				)
				return acc
			}

			return [...acc, file]
		}, [])

	fs.readdirSync(new URL(get_legacy_src_path("final")), {
		withFileTypes: true,
	})
		.filter((file) => {
			return file.isFile() && file.name.startsWith(exercise_id)
		})
		.reduce(function moveExerciseSolution(acc: fs.Dirent[], file) {
			let legacy_ec_id = Number(file.name.match(/-(\d*)\./)?.[1] || 0)
			let new_offset_step_id = legacy_ec_id + 1

			let get_solution_dir = partial(get_new_exercise_path, [
				`${String(new_offset_step_id).padStart(2, "0")}.solution`,
			])

			create_dir(new URL(get_solution_dir()).pathname)

			fs.renameSync(
				new URL(get_legacy_src_path("final", file.name)).pathname,
				new URL(
					get_solution_dir(`index.${get_suffix_from_file_name(file.name)}`)
				).pathname
			)

			return [...acc, file]
		}, [])
}

function get_suffix_from_file_name(file_name: string) {
	return file_name?.split(".")?.at(-1) || ".tsx"
}

function create_dir(dir: string) {
	// https://stackoverflow.com/a/26815894
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir)
		console.log(`✅ Created: ${dir}`)
	}
}
