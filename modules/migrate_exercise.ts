import * as fs from "node:fs"
import path from "node:path"
import partial from "lodash/fp/partial"
import kebabCase from "lodash/kebabCase"
import {titleCase} from "title-case"

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

	let exercise_title = "UNTITLED"

	try {
		exercise_title = fs
			.readFileSync(
				new URL(get_legacy_src_path("exercise", `${exercise_id}.md`)).pathname,
				{
					encoding: "utf-8",
				}
			)
			.split(/^(?=#+ )/m)?.[0]
			.replace(/# /, "")
			.trim()
	} catch (error) {
		console.error(`file doesn't exsist: ${error.path}`)
	}

	let new_exercise_path = path.join(
		new_exercises_path,
		`${exercise_id}.${kebabCase(exercise_title)}`
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
		.reduce(function move_extra_credit_to_step_solutions(
			acc: fs.Dirent[],
			file
		) {
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
		},
		[])

	fs.readdirSync(new URL(get_new_exercise_path()), {withFileTypes: true})
		.filter(
			(dirent) => dirent.isDirectory() && dirent.name.includes("solution")
		)
		.sort(
			(a, b) => Number(a.name.split(".")?.[0]) - Number(b.name.split(".")?.[0])
		)
		.reduce(function copy_step_solution_to_next_step_problem(
			acc: fs.Dirent[],
			dir,
			_,
			items
		) {
			let step_id = Number(dir.name.split(".")[0])
			let offset_problem_id = step_id + 1

			if (step_id < items.length) {
				let step_solution_file = fs.readdirSync(
					new URL(get_new_exercise_path(dir.name)),
					{
						withFileTypes: true,
					}
				)?.[0].name

				try {
					create_dir(
						new URL(
							get_new_exercise_path(
								`${String(offset_problem_id).padStart(2, "0")}.problem`
							)
						).pathname
					)

					fs.copyFileSync(
						new URL(get_new_exercise_path(dir.name, step_solution_file))
							.pathname,
						new URL(
							get_new_exercise_path(
								`${String(offset_problem_id).padStart(
									2,
									"0"
								)}.problem/index.${get_suffix_from_file_name(
									step_solution_file
								)}`
							)
						).pathname
					)
				} catch (error) {
					return [...acc, dir]
				}
			}

			return acc
		},
		[])

	try {
		fs.readFileSync(new URL(get_new_exercise_path("README.mdx")).pathname, {
			encoding: "utf-8",
		})
			.split(/^(?=#+ )/m)
			.filter(Boolean)
			.reduce(function (acc: string[], section) {
				let exercise_section = /#.+Exercise/i

				if (exercise_section.test(section)) {
					let section_body = section
						.split("\n")
						.reduce(
							(acc, line) => {
								if (
									line.startsWith("## ") ||
									line.startsWith("Production deploy") ||
									line.startsWith("- [Exercise") ||
									line.startsWith("- [Final")
								) {
									return acc
								}
								return [...acc, line]
							},
							[`# ${titleCase(exercise_title)}`]
						)
						.join("\n")
						.replace(/\n\n\n/, "\n")

					try {
						fs.writeFileSync(
							new URL(get_new_exercise_path(`01.problem/README.mdx`)).pathname,
							section_body,
							{encoding: "utf-8"}
						)
					} catch (err) {
						console.error(err)
					}

					try {
						fs.writeFileSync(
							new URL(get_new_exercise_path(`01.solution/README.mdx`)).pathname,
							`# ${titleCase(exercise_title)}\n`,
							{encoding: "utf-8"}
						)
					} catch (err) {
						console.error(err)
					}

					return acc
				}

				return [...acc, section]
			}, [])
			.reduce(function (acc: string[], section, _, sections) {
				if (section.match(/#.+\d/i)) {
					let [legacy_extra_credit_id, legacy_title] =
						section
							.match(/#.+(\d).+\p{Emoji_Presentation}.(.+)\n/mu)
							?.slice(1, 3) || []

					let section_body = section
						.split("\n")
						.reduce(
							(acc: string[], line) => {
								if (
									line.startsWith("### ") ||
									line.startsWith("[Production deploy")
								) {
									return acc
								}
								return [...acc, line]
							},
							[`# ${titleCase(legacy_title)}`]
						)
						.join("\n")
						.replace(/\n\n\n/, "\n\n")

					if (Number(legacy_extra_credit_id) <= sections.length) {
						try {
							fs.writeFileSync(
								new URL(
									get_new_exercise_path(
										`0${Number(legacy_extra_credit_id) + 1}.problem/README.mdx`
									)
								).pathname,
								section_body,
								{encoding: "utf-8"}
							)
						} catch (err) {
							console.error(err)
						}

						try {
							fs.writeFileSync(
								new URL(
									get_new_exercise_path(
										`0${Number(legacy_extra_credit_id) + 1}.solution/README.mdx`
									)
								).pathname,
								`# ${titleCase(legacy_title)}\n`,
								{encoding: "utf-8"}
							)
						} catch (err) {
							console.error(err)
						}
					}
					return acc
				}

				return [...acc, section]
			}, [])
			.reduce(function (acc: string[], section) {
				let exercise_section = /#.+Background/i

				if (exercise_section.test(section)) {
					let section_body = section
						.split("\n")
						.reduce(
							(acc, line) => {
								if (line.startsWith("## ")) {
									return acc
								}
								return [...acc, line]
							},
							[`# ${titleCase(exercise_title)}`]
						)
						.join("\n")
						.replace(/\n\n\n/, "\n")

					console.log(section_body)

					try {
						fs.writeFileSync(
							new URL(get_new_exercise_path(`README.mdx`)).pathname,
							section_body,
							{encoding: "utf-8"}
						)
					} catch (err) {
						console.error(err)
					}

					return acc
				}

				return [...acc, section]
			}, [])
	} catch (error) {
		console.error(`file doesn't exsist: ${error.path}`)
	}
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
